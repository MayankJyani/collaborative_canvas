// Collaborative Canvas Server - Express + Socket.io for real-time drawing
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const RoomManager = require('./rooms');

const app = express();
const server = http.createServer(app);

// Set proper MIME types
express.static.mime.types['js'] = 'text/javascript';

// Initialize Socket.io with CORS enabled for client connections
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 60000
});

const roomManager = new RoomManager();
const PORT = process.env.PORT || 3000;

// Serve static files from client directory
const clientPath = path.join(__dirname, '../client');
app.use(express.static(clientPath));

// Serve main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'));
});

// Fallback for any unmatched routes
app.get('*', (req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'));
});

// Health check endpoint for server status
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    rooms: roomManager.getRoomCount(),
    timestamp: Date.now()
  });
});

// Handle new Socket.io connections
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  
  let currentRoom = 'default';
  let currentUser = null;
  // Track strokes being drawn by this socket (not finalized yet)
  const inflightStrokes = new Map(); // strokeId -> { color, lineWidth, tool, points: [] }

  // Join user to a room with name and initialize state
  socket.on('join-room', ({ roomId, userName }) => {
    try {
      currentRoom = roomId || 'default';
      socket.join(currentRoom);

      // Register user in room with assigned color
      currentUser = roomManager.addUserToRoom(currentRoom, socket.id, userName);

      // Get room state for sending to new user
      const room = roomManager.getRoom(currentRoom);
      const users = room.getUsers();
      const operations = room.getCurrentState();

      // Send full canvas state and user list to joining user
      socket.emit('init-state', {
        userId: socket.id,
        user: currentUser,
        users: users,
        operations: operations
      });

      // Notify other users that new user joined
      socket.to(currentRoom).emit('user-joined', currentUser);

      console.log(`User ${socket.id} joined room ${currentRoom}`);
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Handle start of new stroke - Initialize and broadcast to others
  socket.on('draw:start', ({ strokeId, color, lineWidth, tool, point }) => {
    try {
      // Store stroke info until it's finalized
      inflightStrokes.set(strokeId, { color, lineWidth, tool, points: [point] });
      // Broadcast to others for real-time rendering
      socket.to(currentRoom).emit('draw:start', { strokeId, color, lineWidth, tool, point });
    } catch (error) {
      console.error('Error handling draw:start:', error);
    }
  });

  // Handle points being added to current stroke
  socket.on('draw:append', ({ strokeId, points }) => {
    try {
      const s = inflightStrokes.get(strokeId);
      if (!s) return;
      if (Array.isArray(points) && points.length) {
        s.points.push(...points);
        // Broadcast updates to others
        socket.to(currentRoom).emit('draw:append', { strokeId, points });
      }
    } catch (error) {
      console.error('Error handling draw:append:', error);
    }
  });

  // Finalize stroke and save to history
  socket.on('draw:end', ({ strokeId }) => {
    try {
      const s = inflightStrokes.get(strokeId);
      if (!s) return;
      const room = roomManager.getRoom(currentRoom);
      if (!room) return;
      // Commit operation to permanent history
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
      // Broadcast to all so everyone has consistent history
      io.to(currentRoom).emit('draw:final', operation);
    } catch (error) {
      console.error('Error handling draw:end:', error);
    }
  });

  // Broadcast cursor position to other users (throttled on client)
  socket.on('cursor-move', ({ x, y, isDrawing }) => {
    try {
      // Update user cursor position in room
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

  // Undo last operation - affects all users in room
  socket.on('undo', () => {
    try {
      const room = roomManager.getRoom(currentRoom);
      if (!room) return;

      const result = room.undo();
      if (result) {
        // Broadcast undo to everyone so histories stay in sync
        io.to(currentRoom).emit('undo', result);
      }
    } catch (error) {
      console.error('Error handling undo:', error);
    }
  });

  // Redo previously undone operation - affects all users in room
  socket.on('redo', () => {
    try {
      const room = roomManager.getRoom(currentRoom);
      if (!room) return;

      const result = room.redo();
      if (result) {
        // Broadcast redo to everyone so histories stay in sync
        io.to(currentRoom).emit('redo', result);
      }
    } catch (error) {
      console.error('Error handling redo:', error);
    }
  });

  // Clear entire canvas - affects all users in room
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

  // Handle user disconnection - cleanup and notify others
  socket.on('disconnect', () => {
    try {
      // Clear any strokes in progress
      inflightStrokes.clear();
      if (currentRoom && currentUser) {
        // Remove user from room (deletes room if empty)
        roomManager.removeUserFromRoom(currentRoom, socket.id);

        // Notify other users that user left
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

  // Send room statistics to requesting user
  socket.on('get-stats', () => {
    try {
      const stats = roomManager.getRoomStats(currentRoom);
      socket.emit('stats', stats);
    } catch (error) {
      console.error('Error getting stats:', error);
    }
  });
});

// Start server on specified port
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});

// Handle graceful shutdown on SIGTERM
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
