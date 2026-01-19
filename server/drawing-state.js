// DrawingStateManager - Manages canvas state, operation history, and undo/redo functionality
class DrawingStateManager {
  constructor(roomId) {
    this.roomId = roomId;
    this.operations = []; // Global operation history
    this.currentIndex = -1; // Current position in undo/redo stack
    this.users = new Map(); // userId -> user data
  }

  // Add new drawing operation to history with unique ID and timestamp
  addOperation(operation) {
    // Trim future operations when drawing after undo (linear history)
    if (this.currentIndex < this.operations.length - 1) {
      this.operations = this.operations.slice(0, this.currentIndex + 1);
    }

    // Create operation with unique ID for tracking
    const op = {
      ...operation,
      id: `${operation.userId}_${Date.now()}_${Math.random()}`,
      timestamp: Date.now()
    };

    this.operations.push(op);
    this.currentIndex++;

    return op;
  }

  // Move back one operation in history
  undo() {
    if (this.currentIndex < 0) {
      return null;
    }

    const operation = this.operations[this.currentIndex];
    this.currentIndex--;

    return {
      type: 'undo',
      operation,
      currentIndex: this.currentIndex
    };
  }

  // Move forward one operation in history
  redo() {
    if (this.currentIndex >= this.operations.length - 1) {
      return null;
    }

    this.currentIndex++;
    const operation = this.operations[this.currentIndex];

    return {
      type: 'redo',
      operation,
      currentIndex: this.currentIndex
    };
  }

  // Get all operations up to current history position
  getCurrentState() {
    return this.operations.slice(0, this.currentIndex + 1);
  }

  // Add or update user information in room
  addUser(userId, userData) {
    this.users.set(userId, {
      ...userData,
      id: userId,
      joinedAt: Date.now()
    });
  }

  // Remove user from room
  removeUser(userId) {
    this.users.delete(userId);
  }

  // Get all users in room
  getUsers() {
    return Array.from(this.users.values());
  }

  // Get user by ID
  getUser(userId) {
    return this.users.get(userId);
  }

  // Clear all operations and reset history
  clear() {
    this.operations = [];
    this.currentIndex = -1;
  }

  // Get statistics about current drawing state
  getStats() {
    return {
      totalOperations: this.operations.length,
      currentIndex: this.currentIndex,
      activeUsers: this.users.size,
      canUndo: this.currentIndex >= 0,
      canRedo: this.currentIndex < this.operations.length - 1
    };
  }
}

module.exports = DrawingStateManager;
