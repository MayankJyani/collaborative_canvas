// RoomManager - Manages multiple drawing rooms and their states
const DrawingStateManager = require('./drawing-state');

class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId -> DrawingStateManager
    // Pool of colors assigned to users in order
    this.userColors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
      '#F8B739', '#52B788', '#E63946', '#A8DADC'
    ];
    this.colorIndex = 0;
  }

  // Get existing room or create new one if doesn't exist
  getOrCreateRoom(roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new DrawingStateManager(roomId));
    }
    return this.rooms.get(roomId);
  }

  // Get room by ID
  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  // Delete room from manager
  deleteRoom(roomId) {
    this.rooms.delete(roomId);
  }

  // Add user to room with assigned color
  addUserToRoom(roomId, userId, userName) {
    const room = this.getOrCreateRoom(roomId);
    
    // Assign next color in rotation
    const color = this.userColors[this.colorIndex % this.userColors.length];
    this.colorIndex++;

    const userData = {
      id: userId,
      name: userName || `User ${userId.substring(0, 6)}`,
      color: color,
      cursor: { x: 0, y: 0 },
      isDrawing: false
    };

    room.addUser(userId, userData);
    return userData;
  }

  // Remove user from room and delete room if empty
  removeUserFromRoom(roomId, userId) {
    const room = this.getRoom(roomId);
    if (room) {
      room.removeUser(userId);
      
      // Cleanup empty rooms
      if (room.getUsers().length === 0) {
        this.deleteRoom(roomId);
      }
    }
  }

  // Get all users in room
  getRoomUsers(roomId) {
    const room = this.getRoom(roomId);
    return room ? room.getUsers() : [];
  }

  // Update user cursor position and drawing state
  updateUserCursor(roomId, userId, cursor, isDrawing) {
    const room = this.getRoom(roomId);
    if (room) {
      const user = room.getUser(userId);
      if (user) {
        user.cursor = cursor;
        user.isDrawing = isDrawing;
      }
    }
  }

  // Get statistics for a room
  getRoomStats(roomId) {
    const room = this.getRoom(roomId);
    return room ? room.getStats() : null;
  }

  // Get all active room IDs
  getAllRooms() {
    return Array.from(this.rooms.keys());
  }

  // Get count of active rooms
  getRoomCount() {
    return this.rooms.size;
  }
}

module.exports = RoomManager;
