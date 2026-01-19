// WebSocketClient - Handles real-time communication via Socket.io
class WebSocketClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.userId = null;
    this.currentUser = null;
    this.users = new Map();
    this.remoteCursors = new Map();
    
    // Event handlers registry
    this.handlers = {
      'init-state': [],
      'draw:start': [],
      'draw:append': [],
      'draw:final': [],
      'user-joined': [],
      'user-left': [],
      'cursor-move': [],
      'undo': [],
      'redo': [],
      'clear-canvas': [],
      'stats': [],
      'error': []
    };
    
    // Throttle cursor updates to reduce network traffic (50ms = ~20Hz)
    this.lastCursorUpdate = 0;
    this.cursorUpdateInterval = 50; // ms
  }

  // Connect to Socket.io server with reconnection settings
  connect(serverUrl = null) {
    return new Promise((resolve, reject) => {
      try {
        // Use current domain if no URL provided (works in production)
        if (!serverUrl) {
          serverUrl = window.location.origin;
        }
        
        // Initialize Socket.io with reconnection options
        this.socket = io(serverUrl, {
          reconnection: true,
          reconnectionDelay: 1000,
          reconnectionAttempts: 5,
          transports: ['websocket', 'polling']
        });

        // Handle successful connection
        this.socket.on('connect', () => {
          console.log('Connected to server');
          this.connected = true;
          this.userId = this.socket.id;
          resolve();
        });

        // Handle disconnection
        this.socket.on('disconnect', () => {
          console.log('Disconnected from server');
          this.connected = false;
        });

        // Handle connection errors
        this.socket.on('connect_error', (error) => {
          console.error('Connection error:', error);
          reject(error);
        });

        // Setup all Socket.io event listeners
        this.setupEventListeners();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Register Socket.io event listeners for all incoming messages
  setupEventListeners() {
    // Receive initial state when joining room
    this.socket.on('init-state', (data) => {
      this.userId = data.userId;
      this.currentUser = data.user;
      
      // Store all users in current room
      data.users.forEach(user => {
        this.users.set(user.id, user);
      });
      
      this.emit('init-state', data);
    });

    // Receive remote drawing start event
    this.socket.on('draw:start', (payload) => {
      this.emit('draw:start', payload);
    });

    // Receive remote drawing append (points added to stroke)
    this.socket.on('draw:append', (payload) => {
      this.emit('draw:append', payload);
    });

    // Receive finalized remote drawing operation
    this.socket.on('draw:final', (operation) => {
      this.emit('draw:final', operation);
    });

    // User joined room notification
    this.socket.on('user-joined', (user) => {
      this.users.set(user.id, user);
      this.emit('user-joined', user);
    });

    // User left room notification
    this.socket.on('user-left', (data) => {
      this.users.delete(data.userId);
      this.remoteCursors.delete(data.userId);
      this.emit('user-left', data);
    });

    // Receive remote cursor position updates
    this.socket.on('cursor-move', (data) => {
      this.remoteCursors.set(data.userId, {
        x: data.x,
        y: data.y,
        isDrawing: data.isDrawing,
        timestamp: Date.now()
      });
      this.emit('cursor-move', data);
    });

    // Receive undo operation from server
    this.socket.on('undo', (data) => {
      this.emit('undo', data);
    });

    // Receive redo operation from server
    this.socket.on('redo', (data) => {
      this.emit('redo', data);
    });

    // Receive canvas clear operation
    this.socket.on('clear-canvas', () => {
      this.emit('clear-canvas');
    });

    // Receive room statistics
    this.socket.on('stats', (stats) => {
      this.emit('stats', stats);
    });

    // Receive server errors
    this.socket.on('error', (error) => {
      console.error('Server error:', error);
      this.emit('error', error);
    });
  }

  // Join a room with given ID and user name
  joinRoom(roomId = 'default', userName = 'Anonymous') {
    if (!this.connected) {
      console.error('Not connected to server');
      return;
    }

    this.socket.emit('join-room', { roomId, userName });
  }

  // Start streaming a new stroke
  sendDrawStart(payload) {
    if (!this.connected) return;
    this.socket.emit('draw:start', payload);
  }

  // Send points to be appended to current stroke
  sendDrawAppend(payload) {
    if (!this.connected) return;
    this.socket.emit('draw:append', payload);
  }

  // End current stroke
  sendDrawEnd(payload) {
    if (!this.connected) return;
    this.socket.emit('draw:end', payload);
  }

  // Send cursor position (throttled to prevent network spam)
  sendCursorMove(x, y, isDrawing) {
    if (!this.connected) return;
    
    const now = Date.now();
    if (now - this.lastCursorUpdate < this.cursorUpdateInterval) {
      return; // Skip if within throttle interval
    }
    
    this.lastCursorUpdate = now;
    this.socket.emit('cursor-move', { x, y, isDrawing });
  }

  // Request undo operation
  sendUndo() {
    if (!this.connected) return;
    this.socket.emit('undo');
  }

  // Request redo operation
  sendRedo() {
    if (!this.connected) return;
    this.socket.emit('redo');
  }

  // Clear entire canvas
  sendClearCanvas() {
    if (!this.connected) return;
    this.socket.emit('clear-canvas');
  }

  // Request room statistics from server
  requestStats() {
    if (!this.connected) return;
    this.socket.emit('get-stats');
  }

  // Register event handler for incoming events
  on(event, handler) {
    if (this.handlers[event]) {
      this.handlers[event].push(handler);
    }
  }

  // Unregister event handler
  off(event, handler) {
    if (this.handlers[event]) {
      this.handlers[event] = this.handlers[event].filter(h => h !== handler);
    }
  }

  // Trigger all handlers for a given event
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

  // Get all users in current room
  getUsers() {
    return Array.from(this.users.values());
  }

  // Get user by ID
  getUser(userId) {
    return this.users.get(userId);
  }

  // Get current user object
  getCurrentUser() {
    return this.currentUser;
  }

  // Get map of all remote cursors
  getRemoteCursors() {
    return this.remoteCursors;
  }

  // Disconnect from server
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.connected = false;
    }
  }

  // Check connection status
  isConnected() {
    return this.connected;
  }
}
