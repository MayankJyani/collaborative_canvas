/**
 * WebSocketClient
 * Handles real-time communication with the server using Socket.io
 */

class WebSocketClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.userId = null;
    this.currentUser = null;
    this.users = new Map();
    this.remoteCursors = new Map();
    
    // Event handlers
    this.handlers = {
      'init-state': [],
      'draw': [],
      'user-joined': [],
      'user-left': [],
      'cursor-move': [],
      'undo': [],
      'redo': [],
      'clear-canvas': [],
      'stats': [],
      'error': []
    };
    
    // Throttle cursor updates to reduce network traffic
    this.lastCursorUpdate = 0;
    this.cursorUpdateInterval = 50; // ms
  }

  /**
   * Connect to WebSocket server
   */
  connect(serverUrl = 'http://localhost:3000') {
    return new Promise((resolve, reject) => {
      try {
        // Load Socket.io client library dynamically
        this.socket = io(serverUrl, {
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: 5
        });

        this.socket.on('connect', () => {
          console.log('Connected to server');
          this.connected = true;
          this.userId = this.socket.id;
          resolve();
        });

        this.socket.on('disconnect', () => {
          console.log('Disconnected from server');
          this.connected = false;
        });

        this.socket.on('connect_error', (error) => {
          console.error('Connection error:', error);
          reject(error);
        });

        // Setup event listeners
        this.setupEventListeners();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Setup Socket.io event listeners
   */
  setupEventListeners() {
    // Initial state when joining
    this.socket.on('init-state', (data) => {
      this.userId = data.userId;
      this.currentUser = data.user;
      
      // Update users map
      data.users.forEach(user => {
        this.users.set(user.id, user);
      });
      
      this.emit('init-state', data);
    });

    // Drawing events
    this.socket.on('draw', (operation) => {
      this.emit('draw', operation);
    });

    // User management
    this.socket.on('user-joined', (user) => {
      this.users.set(user.id, user);
      this.emit('user-joined', user);
    });

    this.socket.on('user-left', (data) => {
      this.users.delete(data.userId);
      this.remoteCursors.delete(data.userId);
      this.emit('user-left', data);
    });

    // Cursor movement
    this.socket.on('cursor-move', (data) => {
      this.remoteCursors.set(data.userId, {
        x: data.x,
        y: data.y,
        isDrawing: data.isDrawing,
        timestamp: Date.now()
      });
      this.emit('cursor-move', data);
    });

    // Undo/Redo
    this.socket.on('undo', (data) => {
      this.emit('undo', data);
    });

    this.socket.on('redo', (data) => {
      this.emit('redo', data);
    });

    // Clear canvas
    this.socket.on('clear-canvas', () => {
      this.emit('clear-canvas');
    });

    // Stats
    this.socket.on('stats', (stats) => {
      this.emit('stats', stats);
    });

    // Errors
    this.socket.on('error', (error) => {
      console.error('Server error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Join a room
   */
  joinRoom(roomId = 'default', userName = 'Anonymous') {
    if (!this.connected) {
      console.error('Not connected to server');
      return;
    }

    this.socket.emit('join-room', { roomId, userName });
  }

  /**
   * Send drawing data
   */
  sendDraw(pathData) {
    if (!this.connected) return;
    
    this.socket.emit('draw', pathData);
  }

  /**
   * Send cursor position (throttled)
   */
  sendCursorMove(x, y, isDrawing) {
    if (!this.connected) return;
    
    const now = Date.now();
    if (now - this.lastCursorUpdate < this.cursorUpdateInterval) {
      return;
    }
    
    this.lastCursorUpdate = now;
    this.socket.emit('cursor-move', { x, y, isDrawing });
  }

  /**
   * Request undo
   */
  sendUndo() {
    if (!this.connected) return;
    this.socket.emit('undo');
  }

  /**
   * Request redo
   */
  sendRedo() {
    if (!this.connected) return;
    this.socket.emit('redo');
  }

  /**
   * Clear canvas
   */
  sendClearCanvas() {
    if (!this.connected) return;
    this.socket.emit('clear-canvas');
  }

  /**
   * Request room stats
   */
  requestStats() {
    if (!this.connected) return;
    this.socket.emit('get-stats');
  }

  /**
   * Register event handler
   */
  on(event, handler) {
    if (this.handlers[event]) {
      this.handlers[event].push(handler);
    }
  }

  /**
   * Remove event handler
   */
  off(event, handler) {
    if (this.handlers[event]) {
      this.handlers[event] = this.handlers[event].filter(h => h !== handler);
    }
  }

  /**
   * Emit event to registered handlers
   */
  emit(event, data) {
    if (this.handlers[event]) {
      this.handlers[event].forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in ${event} handler:`, error);
        }
      });
    }
  }

  /**
   * Get all users in current room
   */
  getUsers() {
    return Array.from(this.users.values());
  }

  /**
   * Get user by ID
   */
  getUser(userId) {
    return this.users.get(userId);
  }

  /**
   * Get current user data
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Get remote cursors
   */
  getRemoteCursors() {
    return this.remoteCursors;
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.connected = false;
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.connected;
  }
}
