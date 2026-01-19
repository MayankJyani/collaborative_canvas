// Main collaborative canvas app - Integrates drawing, WebSocket, and UI
class CollaborativeCanvas {
  constructor() {
    this.canvas = null;
    this.wsClient = null;
    this.operationHistory = [];
    this.currentIndex = -1;
    this.localOperations = [];
    
    // Cursor animation frame ID
    this.cursorAnimationFrame = null;
    
    this.init();
  }

  // Initialize application - Set up canvas, WebSocket, and UI
  async init() {
    // Initialize canvas manager
    const canvasElement = document.getElementById('drawing-canvas');
    this.canvas = new CanvasManager(canvasElement);
    
    // Initialize WebSocket client
    this.wsClient = new WebSocketClient();
    
    // Setup all UI and event listeners
    this.setupUI();
    this.setupCanvasEvents();

    // Setup cursor overlay canvas for showing remote users' cursors
    this.cursorCanvas = document.getElementById('cursor-layer');
    this.cursorCtx = this.cursorCanvas.getContext('2d');
    this.resizeCursorCanvas();
    
    // Setup WebSocket handlers
    this.setupWebSocketHandlers();
    
    // Connect to server
    try {
      await this.wsClient.connect();
      
      // Get room ID from URL or use default room
      const urlParams = new URLSearchParams(window.location.search);
      const roomId = urlParams.get('room') || 'default';
      const userName = this.promptUserName();
      
      this.wsClient.joinRoom(roomId, userName);
      
      this.updateStatus('Connected', 'success');
    } catch (error) {
      console.error('Failed to connect:', error);
      this.updateStatus('Connection failed', 'error');
    }
    
    // Start animating remote cursors
    this.animateCursors();
  }

  // Get or prompt for user name, store in localStorage
  promptUserName() {
    const saved = localStorage.getItem('userName');
    if (saved) return saved;
    
    const name = prompt('Enter your name:', 'Anonymous') || 'Anonymous';
    localStorage.setItem('userName', name);
    return name;
  }

  // Setup all UI event listeners (tools, color picker, buttons, etc)
  setupUI() {
    // Tool selection buttons
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tool = e.target.closest('.tool-btn').dataset.tool;
        this.selectTool(tool);
      });
    });
    
    // Color picker input
    const colorPicker = document.getElementById('color-picker');
    colorPicker.addEventListener('input', (e) => {
      this.canvas.setColor(e.target.value);
      this.updateColorDisplay(e.target.value);
    });
    
    // Line width slider
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
    
    // Clear canvas button
    document.getElementById('clear-btn').addEventListener('click', () => {
      if (confirm('Clear the entire canvas? This affects all users.')) {
        this.wsClient.sendClearCanvas();
      }
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
      const operations = this.operationHistory.slice(0, this.currentIndex + 1);
      this.canvas.resizeCanvas();
      this.resizeCursorCanvas();
      this.canvas.redrawFromHistory(operations);
    });
    
    // Keyboard shortcuts (Ctrl+Z for undo, Ctrl+Shift+Z for redo)
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

  // Setup canvas mouse and touch event listeners
  setupCanvasEvents() {
    const canvas = this.canvas.canvas;
    
    // Mouse events
    canvas.addEventListener('mousedown', (e) => this.handleDrawStart(e));
    canvas.addEventListener('mousemove', (e) => this.handleDrawMove(e));
    canvas.addEventListener('mouseup', (e) => this.handleDrawEnd(e));
    canvas.addEventListener('mouseleave', (e) => this.handleDrawEnd(e));
    
    // Touch events for mobile devices
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

  // Handle drawing start - Initialize stroke and send to server
  handleDrawStart(event) {
    const coords = this.canvas.getCanvasCoordinates(event);
    this.canvas.startDrawing(coords.x, coords.y);
    this.wsClient.sendCursorMove(coords.x, coords.y, true);

    // Begin streaming stroke to server
    this.currentStrokeId = `${this.wsClient.userId}-${Date.now()}`;
    this.strokeMeta = {
      color: this.canvas.color,
      lineWidth: this.canvas.lineWidth,
      tool: this.canvas.tool
    };
    this.pendingPoints = [{ x: coords.x, y: coords.y }];
    this.lastAppendTs = performance.now();
    this.wsClient.sendDrawStart({
      strokeId: this.currentStrokeId,
      ...this.strokeMeta,
      point: { x: coords.x, y: coords.y }
    });
  }

  // Handle drawing movement - Buffer and send points periodically
  handleDrawMove(event) {
    const coords = this.canvas.getCanvasCoordinates(event);
    
    if (this.canvas.isDrawing) {
      this.canvas.continueDrawing(coords.x, coords.y);

      // Buffer points and send in batches
      this.pendingPoints.push({ x: coords.x, y: coords.y });
      const now = performance.now();
      if (now - this.lastAppendTs > 16 || this.pendingPoints.length >= 6) {
        this.wsClient.sendDrawAppend({
          strokeId: this.currentStrokeId,
          points: this.pendingPoints
        });
        this.pendingPoints = [];
        this.lastAppendTs = now;
      }
    }
    
    this.wsClient.sendCursorMove(coords.x, coords.y, this.canvas.isDrawing);
  }

  // Handle drawing end - Flush remaining points and close stroke
  handleDrawEnd(event) {
    const pathData = this.canvas.stopDrawing();

    // Send any remaining buffered points
    if (this.currentStrokeId) {
      if (this.pendingPoints && this.pendingPoints.length) {
        this.wsClient.sendDrawAppend({
          strokeId: this.currentStrokeId,
          points: this.pendingPoints
        });
        this.pendingPoints = [];
      }
      this.wsClient.sendDrawEnd({ strokeId: this.currentStrokeId });
    }

    const coords = this.canvas.getCanvasCoordinates(event);
    this.wsClient.sendCursorMove(coords.x, coords.y, false);
  }

  // Setup WebSocket event handlers for real-time collaboration
  setupWebSocketHandlers() {
    // Receive initial canvas state and user list on connection
    this.wsClient.on('init-state', (data) => {
      console.log('Received initial state', data);
      
      // Store operation history
      this.operationHistory = data.operations;
      this.currentIndex = data.operations.length - 1;
      
      // Redraw canvas from history
      this.canvas.redrawFromHistory(data.operations);
      
      // Update user lists
      this.updateUserList(data.users);
      this.updateUserInfo(data.user);
    });
    
    // Handle remote stroke streaming - Start
    this.remoteStrokes = new Map();
    this.wsClient.on('draw:start', ({ strokeId, color, lineWidth, tool, point }) => {
      this.remoteStrokes.set(strokeId, { color, lineWidth, tool, points: [point] });
      this.canvas.drawPath([point], color, lineWidth, tool);
    });

    // Handle remote stroke streaming - Append points
    this.wsClient.on('draw:append', ({ strokeId, points }) => {
      const s = this.remoteStrokes.get(strokeId);
      if (!s) return;
      s.points.push(...points);
      this.canvas.drawPath(s.points, s.color, s.lineWidth, s.tool);
    });

    // Handle final stroke operation
    this.wsClient.on('draw:final', (operation) => {
      this.operationHistory.push(operation);
      this.currentIndex++;
      this.remoteStrokes.delete(operation.strokeId);
    });
    
    // User joined notification
    this.wsClient.on('user-joined', (user) => {
      console.log('User joined:', user.name);
      this.updateUserList(this.wsClient.getUsers());
      this.showNotification(`${user.name} joined`);
    });
    
    // User left notification
    this.wsClient.on('user-left', (data) => {
      console.log('User left:', data.userName);
      this.updateUserList(this.wsClient.getUsers());
      this.showNotification(`${data.userName} left`);
    });
    
    // Handle undo operation from server
    this.wsClient.on('undo', (data) => {
      this.currentIndex = data.currentIndex;
      const operations = this.operationHistory.slice(0, this.currentIndex + 1);
      this.canvas.redrawFromHistory(operations);
    });
    
    // Handle redo operation from server
    this.wsClient.on('redo', (data) => {
      this.currentIndex = data.currentIndex;
      const operations = this.operationHistory.slice(0, this.currentIndex + 1);
      this.canvas.redrawFromHistory(operations);
    });
    
    // Handle canvas clear operation
    this.wsClient.on('clear-canvas', () => {
      this.operationHistory = [];
      this.currentIndex = -1;
      this.canvas.clear();
    });
  }

  // Animate and draw remote users' cursors on overlay
  animateCursors() {
    const draw = () => {
      // Clear and redraw cursors each frame
      const c = this.cursorCanvas;
      const ctx = this.cursorCtx;
      ctx.clearRect(0, 0, c.width, c.height);

      const remoteCursors = this.wsClient.getRemoteCursors();
      const now = Date.now();
      
      // Draw each remote cursor
      remoteCursors.forEach((cursor, userId) => {
        if (now - cursor.timestamp > 2000) return; // Skip stale cursors
        const user = this.wsClient.getUser(userId);
        if (!user) return;
        this.drawCursorOnOverlay(cursor.x, cursor.y, user.color, cursor.isDrawing);
      });
      
      this.cursorAnimationFrame = requestAnimationFrame(draw);
    };
    
    draw();
  }

  // Select a drawing tool and update UI
  selectTool(tool) {
    this.canvas.setTool(tool);
    
    // Update active button styling
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-tool="${tool}"]`).classList.add('active');
  }

  // Update user list display
  updateUserList(users) {
    const userList = document.getElementById('user-list');
    userList.innerHTML = users.map(user => `
      <div class="user-item">
        <span class="user-color" style="background-color: ${user.color}"></span>
        <span class="user-name">${user.name}</span>
      </div>
    `).join('');
  }

  // Update current user info display
  updateUserInfo(user) {
    document.getElementById('current-user').textContent = user.name;
    document.getElementById('user-color-indicator').style.backgroundColor = user.color;
  }

  // Update color preview display
  updateColorDisplay(color) {
    document.getElementById('current-color').style.backgroundColor = color;
  }

  // Update line width value display
  updateLineWidthDisplay(width) {
    document.getElementById('line-width-value').textContent = width + 'px';
  }

  // Update connection status indicator
  updateStatus(message, type = 'info') {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status status-${type}`;
  }

  // Show temporary notification toast
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

  // Resize cursor overlay canvas to match device pixel ratio
  resizeCursorCanvas() {
    const rect = this.canvas.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.cursorCanvas.width = rect.width * dpr;
    this.cursorCanvas.height = rect.height * dpr;
    this.cursorCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.cursorCtx.scale(dpr, dpr);
  }

  // Draw remote cursor on overlay canvas
  drawCursorOnOverlay(x, y, color, isDrawing) {
    const ctx = this.cursorCtx;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, isDrawing ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, isDrawing ? 8 : 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.app = new CollaborativeCanvas();
});
