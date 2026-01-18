/**
 * Collaborative Canvas Server
 * Express + Socket.io server for real-time drawing synchronization
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const RoomManager = require('./rooms');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const roomManager = new RoomManager();
const PORT = process.env.PORT || 3000;

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    rooms: roomManager.getRoomCount(),
    timestamp: Date.now()
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  let currentRoom = 'default';
  let currentUser = null;
  // Aggregate in-flight strokes per socket
  const inflightStrokes = new Map(); // strokeId -> { color, lineWidth, tool, points: [] }

  /**
   * Join a room
   */
  socket.on('join-room', ({ roomId, userName }) => {
    try {
      currentRoom = roomId || 'default';
      socket.join(currentRoom);

      // Add user to room and get assigned data
      currentUser = roomManager.addUserToRoom(currentRoom, socket.id, userName);

      // Get room state and users
      const room = roomManager.getRoom(currentRoom);
      const users = room.getUsers();
      const operations = room.getCurrentState();

      // Send initial state to joining user
      socket.emit('init-state', {
        userId: socket.id,
        user: currentUser,
        users: users,
        operations: operations
      });

      // Notify other users about new user
      socket.to(currentRoom).emit('user-joined', currentUser);

      console.log(`User ${socket.id} joined room ${currentRoom}`);
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

/**
   * Handle streaming drawing events (start/append/end)
   */
  socket.on('draw:start', ({ strokeId, color, lineWidth, tool, point }) => {
    try {
      inflightStrokes.set(strokeId, { color, lineWidth, tool, points: [point] });
      // Broadcast to others for live rendering
      socket.to(currentRoom).emit('draw:start', { strokeId, color, lineWidth, tool, point });
    } catch (error) {
      console.error('Error handling draw:start:', error);
    }
  });

  socket.on('draw:append', ({ strokeId, points }) => {
    try {
      const s = inflightStrokes.get(strokeId);
      if (!s) return;
      if (Array.isArray(points) && points.length) {
        s.points.push(...points);
        // Broadcast to others
        socket.to(currentRoom).emit('draw:append', { strokeId, points });
      }
    } catch (error) {
      console.error('Error handling draw:append:', error);
    }
  });

  socket.on('draw:end', ({ strokeId }) => {
    try {
      const s = inflightStrokes.get(strokeId);
      if (!s) return;
      const room = roomManager.getRoom(currentRoom);
      if (!room) return;
      // Commit canonical operation with strokeId
      const operation = room.addOperation({
        type: 'draw',
        userId: socket.id,
        strokeId,
        points: s.points,
        color: s.color,
        lineWidth: s.lineWidth,
        tool: s.tool
      });
      inflightStrokes.delete(strokeId);
      // Broadcast final operation to ALL (including sender) so histories stay consistent
      io.to(currentRoom).emit('draw:final', operation);
    } catch (error) {
      console.error('Error handling draw:end:', error);
    }
  });

  /**
   * Handle cursor movement
   * High-frequency event with throttling on client side
   */
  socket.on('cursor-move', ({ x, y, isDrawing }) => {
    try {
      roomManager.updateUserCursor(currentRoom, socket.id, { x, y }, isDrawing);

      // Broadcast cursor position to other users
      socket.to(currentRoom).emit('cursor-move', {
        userId: socket.id,
        x,
        y,
        isDrawing
      });
    } catch (error) {
      console.error('Error handling cursor move:', error);
    }
  });

  /**
   * Handle undo operation
   * Global undo affects all users
   */
  socket.on('undo', () => {
    try {
      const room = roomManager.getRoom(currentRoom);
      if (!room) return;

      const result = room.undo();
      if (result) {
        // Broadcast undo to all users including sender
        io.to(currentRoom).emit('undo', result);
      }
    } catch (error) {
      console.error('Error handling undo:', error);
    }
  });

  /**
   * Handle redo operation
   * Global redo affects all users
   */
  socket.on('redo', () => {
    try {
      const room = roomManager.getRoom(currentRoom);
      if (!room) return;

      const result = room.redo();
      if (result) {
        // Broadcast redo to all users including sender
        io.to(currentRoom).emit('redo', result);
      }
    } catch (error) {
      console.error('Error handling redo:', error);
    }
  });

  /**
   * Handle clear canvas
   */
  socket.on('clear-canvas', () => {
    try {
      const room = roomManager.getRoom(currentRoom);
      if (!room) return;

      room.clear();

      // Broadcast clear to all users
      io.to(currentRoom).emit('clear-canvas');
    } catch (error) {
      console.error('Error handling clear canvas:', error);
    }
  });

  /**
   * Handle disconnection
   */
  socket.on('disconnect', () => {
    try {
      inflightStrokes.clear();
      if (currentRoom && currentUser) {
        roomManager.removeUserFromRoom(currentRoom, socket.id);

        // Notify other users
        socket.to(currentRoom).emit('user-left', {
          userId: socket.id,
          userName: currentUser.name
        });

        console.log(`User ${socket.id} disconnected from room ${currentRoom}`);
      }
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });

  /**
   * Request current room stats
   */
  socket.on('get-stats', () => {
    try {
      const stats = roomManager.getRoomStats(currentRoom);
      socket.emit('stats', stats);
    } catch (error) {
      console.error('Error getting stats:', error);
    }
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
