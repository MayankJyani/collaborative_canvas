/**
 * Main Application
 * Integrates canvas drawing, WebSocket communication, and UI
 */

class CollaborativeCanvas {
  constructor() {
    this.canvas = null;
    this.wsClient = null;
    this.operationHistory = [];
    this.currentIndex = -1;
    this.localOperations = []; // Track local operations for client-side prediction
    
    // Cursor animation frame
    this.cursorAnimationFrame = null;
    
    this.init();
  }

  /**
   * Initialize the application
   */
  async init() {
    // Initialize canvas
    const canvasElement = document.getElementById('drawing-canvas');
    this.canvas = new CanvasManager(canvasElement);
    
    // Initialize WebSocket client
    this.wsClient = new WebSocketClient();
    
    // Setup UI event listeners
    this.setupUI();
    
    // Setup canvas event listeners
    this.setupCanvasEvents();
    
    // Setup WebSocket event handlers
    this.setupWebSocketHandlers();
    
    // Connect to server
    try {
      await this.wsClient.connect();
      
      // Join room (get room ID from URL or use default)
      const urlParams = new URLSearchParams(window.location.search);
      const roomId = urlParams.get('room') || 'default';
      const userName = this.promptUserName();
      
      this.wsClient.joinRoom(roomId, userName);
      
      this.updateStatus('Connected', 'success');
    } catch (error) {
      console.error('Failed to connect:', error);
      this.updateStatus('Connection failed', 'error');
    }
    
    // Start cursor animation
    this.animateCursors();
  }

  /**
   * Prompt for user name
   */
  promptUserName() {
    const saved = localStorage.getItem('userName');
    if (saved) return saved;
    
    const name = prompt('Enter your name:', 'Anonymous') || 'Anonymous';
    localStorage.setItem('userName', name);
    return name;
  }

  /**
   * Setup UI controls
   */
  setupUI() {
    // Tool selection
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tool = e.target.dataset.tool;
        this.selectTool(tool);
      });
    });
    
    // Color picker
    const colorPicker = document.getElementById('color-picker');
    colorPicker.addEventListener('input', (e) => {
      this.canvas.setColor(e.target.value);
      this.updateColorDisplay(e.target.value);
    });
    
    // Line width
    const lineWidth = document.getElementById('line-width');
    lineWidth.addEventListener('input', (e) => {
      this.canvas.setLineWidth(parseInt(e.target.value));
      this.updateLineWidthDisplay(e.target.value);
    });
    
    // Undo/Redo buttons
    document.getElementById('undo-btn').addEventListener('click', () => {
      this.wsClient.sendUndo();
    });
    
    document.getElementById('redo-btn').addEventListener('click', () => {
      this.wsClient.sendRedo();
    });
    
    // Clear button
    document.getElementById('clear-btn').addEventListener('click', () => {
      if (confirm('Clear the entire canvas? This affects all users.')) {
        this.wsClient.sendClearCanvas();
      }
    });
    
    // Window resize
    window.addEventListener('resize', () => {
      const operations = this.operationHistory.slice(0, this.currentIndex + 1);
      this.canvas.resizeCanvas();
      this.canvas.redrawFromHistory(operations);
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            this.wsClient.sendRedo();
          } else {
            this.wsClient.sendUndo();
          }
        }
      }
    });
  }

  /**
   * Setup canvas event listeners for drawing
   */
  setupCanvasEvents() {
    const canvas = this.canvas.canvas;
    
    // Mouse events
    canvas.addEventListener('mousedown', (e) => this.handleDrawStart(e));
    canvas.addEventListener('mousemove', (e) => this.handleDrawMove(e));
    canvas.addEventListener('mouseup', (e) => this.handleDrawEnd(e));
    canvas.addEventListener('mouseleave', (e) => this.handleDrawEnd(e));
    
    // Touch events for mobile
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.handleDrawStart(e);
    });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      this.handleDrawMove(e);
    });
    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.handleDrawEnd(e);
    });
  }

  /**
   * Handle start of drawing
   */
  handleDrawStart(event) {
    const coords = this.canvas.getCanvasCoordinates(event);
    this.canvas.startDrawing(coords.x, coords.y);
    this.wsClient.sendCursorMove(coords.x, coords.y, true);
  }

  /**
   * Handle drawing movement
   */
  handleDrawMove(event) {
    const coords = this.canvas.getCanvasCoordinates(event);
    
    if (this.canvas.isDrawing) {
      this.canvas.continueDrawing(coords.x, coords.y);
    }
    
    this.wsClient.sendCursorMove(coords.x, coords.y, this.canvas.isDrawing);
  }

  /**
   * Handle end of drawing
   */
  handleDrawEnd(event) {
    const pathData = this.canvas.stopDrawing();
    
    if (pathData) {
      // Send to server
      this.wsClient.sendDraw(pathData);
      
      // Store locally for client-side prediction
      this.localOperations.push(pathData);
    }
    
    const coords = this.canvas.getCanvasCoordinates(event);
    this.wsClient.sendCursorMove(coords.x, coords.y, false);
  }

  /**
   * Setup WebSocket event handlers
   */
  setupWebSocketHandlers() {
    // Initial state
    this.wsClient.on('init-state', (data) => {
      console.log('Received initial state', data);
      
      // Store operation history
      this.operationHistory = data.operations;
      this.currentIndex = data.operations.length - 1;
      
      // Redraw canvas from history
      this.canvas.redrawFromHistory(data.operations);
      
      // Update user list
      this.updateUserList(data.users);
      
      // Update user info display
      this.updateUserInfo(data.user);
    });
    
    // Remote drawing
    this.wsClient.on('draw', (operation) => {
      // Add to history
      this.operationHistory.push(operation);
      this.currentIndex++;
      
      // Draw on canvas
      this.canvas.drawOperation(operation);
    });
    
    // User joined
    this.wsClient.on('user-joined', (user) => {
      console.log('User joined:', user.name);
      this.updateUserList(this.wsClient.getUsers());
      this.showNotification(`${user.name} joined`);
    });
    
    // User left
    this.wsClient.on('user-left', (data) => {
      console.log('User left:', data.userName);
      this.updateUserList(this.wsClient.getUsers());
      this.showNotification(`${data.userName} left`);
    });
    
    // Undo
    this.wsClient.on('undo', (data) => {
      this.currentIndex = data.currentIndex;
      const operations = this.operationHistory.slice(0, this.currentIndex + 1);
      this.canvas.redrawFromHistory(operations);
    });
    
    // Redo
    this.wsClient.on('redo', (data) => {
      this.currentIndex = data.currentIndex;
      const operations = this.operationHistory.slice(0, this.currentIndex + 1);
      this.canvas.redrawFromHistory(operations);
    });
    
    // Clear canvas
    this.wsClient.on('clear-canvas', () => {
      this.operationHistory = [];
      this.currentIndex = -1;
      this.canvas.clear();
    });
  }

  /**
   * Animate remote cursors
   */
  animateCursors() {
    const draw = () => {
      // Only redraw cursors, not the entire canvas
      const remoteCursors = this.wsClient.getRemoteCursors();
      const now = Date.now();
      
      remoteCursors.forEach((cursor, userId) => {
        // Skip old cursors (not updated in last 2 seconds)
        if (now - cursor.timestamp > 2000) return;
        
        const user = this.wsClient.getUser(userId);
        if (user) {
          this.canvas.drawCursor(cursor.x, cursor.y, user.color, cursor.isDrawing);
        }
      });
      
      this.cursorAnimationFrame = requestAnimationFrame(draw);
    };
    
    draw();
  }

  /**
   * Select drawing tool
   */
  selectTool(tool) {
    this.canvas.setTool(tool);
    
    // Update UI
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tool="${tool}"]`).classList.add('active');
  }

  /**
   * Update user list in UI
   */
  updateUserList(users) {
    const userList = document.getElementById('user-list');
    userList.innerHTML = users.map(user => `
      <div class="user-item">
        <span class="user-color" style="background-color: ${user.color}"></span>
        <span class="user-name">${user.name}</span>
      </div>
    `).join('');
  }

  /**
   * Update current user info
   */
  updateUserInfo(user) {
    document.getElementById('current-user').textContent = user.name;
    document.getElementById('user-color-indicator').style.backgroundColor = user.color;
  }

  /**
   * Update color display
   */
  updateColorDisplay(color) {
    document.getElementById('current-color').style.backgroundColor = color;
  }

  /**
   * Update line width display
   */
  updateLineWidthDisplay(width) {
    document.getElementById('line-width-value').textContent = width + 'px';
  }

  /**
   * Update connection status
   */
  updateStatus(message, type = 'info') {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status status-${type}`;
  }

  /**
   * Show temporary notification
   */
  showNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new CollaborativeCanvas();
});
