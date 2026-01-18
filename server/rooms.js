/**
 * RoomManager
 * Manages multiple drawing rooms and their states
 */

const DrawingStateManager = require('./drawing-state');

class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId -> DrawingStateManager
    this.userColors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
      '#F8B739', '#52B788', '#E63946', '#A8DADC'
    ];
    this.colorIndex = 0;
  }

  /**
   * Get or create a room
   * @param {string} roomId - Room identifier
   * @returns {DrawingStateManager} Room state manager
   */
  getOrCreateRoom(roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new DrawingStateManager(roomId));
    }
    return this.rooms.get(roomId);
  }

  /**
   * Get a room
   * @param {string} roomId - Room identifier
   * @returns {DrawingStateManager|undefined} Room state manager
   */
  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  /**
   * Delete a room
   * @param {string} roomId - Room identifier
   */
  deleteRoom(roomId) {
    this.rooms.delete(roomId);
  }

  /**
   * Add user to room
   * @param {string} roomId - Room identifier
   * @param {string} userId - User identifier
   * @param {string} userName - User name
   * @returns {Object} User data including assigned color
   */
  addUserToRoom(roomId, userId, userName) {
    const room = this.getOrCreateRoom(roomId);
    
    // Assign color to user
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

  /**
   * Remove user from room
   * @param {string} roomId - Room identifier
   * @param {string} userId - User identifier
   */
  removeUserFromRoom(roomId, userId) {
    const room = this.getRoom(roomId);
    if (room) {
      room.removeUser(userId);
      
      // Delete room if empty
      if (room.getUsers().length === 0) {
        this.deleteRoom(roomId);
      }
    }
  }

  /**
   * Get all users in room
   * @param {string} roomId - Room identifier
   * @returns {Array} Array of users
   */
  getRoomUsers(roomId) {
    const room = this.getRoom(roomId);
    return room ? room.getUsers() : [];
  }

  /**
   * Update user cursor position
   * @param {string} roomId - Room identifier
   * @param {string} userId - User identifier
   * @param {Object} cursor - Cursor position {x, y}
   * @param {boolean} isDrawing - Whether user is currently drawing
   */
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

  /**
   * Get room statistics
   * @param {string} roomId - Room identifier
   * @returns {Object|null} Room statistics
   */
  getRoomStats(roomId) {
    const room = this.getRoom(roomId);
    return room ? room.getStats() : null;
  }

  /**
   * Get all rooms
   * @returns {Array} Array of room IDs
   */
  getAllRooms() {
    return Array.from(this.rooms.keys());
  }

  /**
   * Get total number of rooms
   * @returns {number} Number of active rooms
   */
  getRoomCount() {
    return this.rooms.size;
  }
}

module.exports = RoomManager;
