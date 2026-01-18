/**
 * DrawingStateManager
 * Manages canvas state, operation history, and undo/redo functionality
 */

class DrawingStateManager {
  constructor(roomId) {
    this.roomId = roomId;
    this.operations = []; // Global operation history
    this.currentIndex = -1; // Current position in history
    this.users = new Map(); // userId -> user data
  }

  /**
   * Add a new drawing operation to history
   * @param {Object} operation - Drawing operation data
   */
  addOperation(operation) {
    // Remove any operations after current index (when drawing after undo)
    if (this.currentIndex < this.operations.length - 1) {
      this.operations = this.operations.slice(0, this.currentIndex + 1);
    }

    // Add operation with timestamp and unique ID
    const op = {
      ...operation,
      id: `${operation.userId}_${Date.now()}_${Math.random()}`,
      timestamp: Date.now()
    };

    this.operations.push(op);
    this.currentIndex++;

    return op;
  }

  /**
   * Undo last operation
   * @returns {Object|null} The operation to undo
   */
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

  /**
   * Redo previously undone operation
   * @returns {Object|null} The operation to redo
   */
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

  /**
   * Get all current operations (up to currentIndex)
   * @returns {Array} Array of operations
   */
  getCurrentState() {
    return this.operations.slice(0, this.currentIndex + 1);
  }

  /**
   * Add or update user information
   * @param {string} userId - User ID
   * @param {Object} userData - User data (color, name, etc.)
   */
  addUser(userId, userData) {
    this.users.set(userId, {
      ...userData,
      id: userId,
      joinedAt: Date.now()
    });
  }

  /**
   * Remove user
   * @param {string} userId - User ID
   */
  removeUser(userId) {
    this.users.delete(userId);
  }

  /**
   * Get all users
   * @returns {Array} Array of user data
   */
  getUsers() {
    return Array.from(this.users.values());
  }

  /**
   * Get user by ID
   * @param {string} userId - User ID
   * @returns {Object|undefined} User data
   */
  getUser(userId) {
    return this.users.get(userId);
  }

  /**
   * Clear all operations and reset state
   */
  clear() {
    this.operations = [];
    this.currentIndex = -1;
  }

  /**
   * Get statistics about the current state
   * @returns {Object} State statistics
   */
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
