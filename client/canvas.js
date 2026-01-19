/**
 * CanvasManager - Handles all canvas drawing operations
 */

class CanvasManager {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d', { willReadFrequently: false });
    
    // Drawing state
    this.isDrawing = false;
    this.currentPath = [];
    this.tool = 'brush'; // 'brush' or 'eraser'
    this.color = '#000000';
    this.lineWidth = 2;
    
    // Offscreen canvas for performance optimization
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    
    this.resizeCanvas();
    this.setupCanvas();
  }

  // Resize canvas to match display size and device pixel ratio
  resizeCanvas() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    
    this.offscreenCanvas.width = this.canvas.width;
    this.offscreenCanvas.height = this.canvas.height;
    
    // Reset transforms to prevent compounding on resize
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.offscreenCtx.setTransform(1, 0, 0, 1, 0, 0);
    
    // Scale contexts for device pixel ratio
    this.ctx.scale(dpr, dpr);
    this.offscreenCtx.scale(dpr, dpr);
    
    this.setupCanvas();
  }

  // Set up canvas rendering properties (smooth lines, rounded caps)
  setupCanvas() {
    const ctx = this.ctx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.imageSmoothingEnabled = true;
    
    const offCtx = this.offscreenCtx;
    offCtx.lineCap = 'round';
    offCtx.lineJoin = 'round';
    offCtx.imageSmoothingEnabled = true;
  }

  // Convert mouse/touch event coordinates to canvas coordinates
  getCanvasCoordinates(event) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = event.clientX || (event.touches && event.touches[0].clientX);
    const clientY = event.clientY || (event.touches && event.touches[0].clientY);
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  // Start a new drawing path
  startDrawing(x, y) {
    this.isDrawing = true;
    this.currentPath = [{ x, y }];
  }

  // Add point to current drawing path
  continueDrawing(x, y) {
    if (!this.isDrawing) return;
    
    this.currentPath.push({ x, y });
    
    // Draw immediately for user feedback
    this.drawPath(this.currentPath, this.color, this.lineWidth, this.tool);
  }

  // Stop drawing and return path data
  stopDrawing() {
    if (!this.isDrawing) return null;
    
    this.isDrawing = false;
    
    const pathData = {
      points: this.currentPath,
      color: this.color,
      lineWidth: this.lineWidth,
      tool: this.tool
    };
    
    this.currentPath = [];
    return pathData;
  }

  // Draw a path on canvas (used for local and remote drawing)
  drawPath(points, color, lineWidth, tool = 'brush') {
    if (!points || points.length === 0) return;
    
    const ctx = this.ctx;
    
    ctx.save();
    
    // Handle eraser vs brush
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = color;
    }
    
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    
    // Draw smooth lines using quadratic curves
    if (points.length === 1) {
      const point = points[0];
      ctx.arc(point.x, point.y, lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (points.length === 2) {
      ctx.moveTo(points[0].x, points[0].y);
      ctx.lineTo(points[1].x, points[1].y);
      ctx.stroke();
    } else {
      ctx.moveTo(points[0].x, points[0].y);
      
      for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
      
      const last = points[points.length - 1];
      const secondLast = points[points.length - 2];
      ctx.quadraticCurveTo(secondLast.x, secondLast.y, last.x, last.y);
      ctx.stroke();
    }
    
    ctx.restore();
  }

  // Render operation from history (for undo/redo)
  drawOperation(operation) {
    if (operation.type === 'draw') {
      this.drawPath(operation.points, operation.color, operation.lineWidth, operation.tool);
    }
  }

  // Clear entire canvas
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  // Redraw canvas from operation history
  redrawFromHistory(operations) {
    this.clear();
    
    for (const operation of operations) {
      this.drawOperation(operation);
    }
  }

  // Update drawing tool
  setTool(tool) {
    this.tool = tool;
  }

  // Update drawing color
  setColor(color) {
    this.color = color;
  }

  // Update line width
  setLineWidth(width) {
    this.lineWidth = width;
  }

  // Get current drawing state
  getState() {
    return {
      tool: this.tool,
      color: this.color,
      lineWidth: this.lineWidth,
      isDrawing: this.isDrawing
    };
  }

  // Draw remote user's cursor indicator
  drawCursor(x, y, color, isDrawing) {
    const ctx = this.ctx;
    
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    
    // Draw filled circle
    ctx.beginPath();
    ctx.arc(x, y, isDrawing ? 4 : 3, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw outline circle
    ctx.beginPath();
    ctx.arc(x, y, isDrawing ? 8 : 6, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.restore();
  }

  // Export canvas as image data URL
  toDataURL(type = 'image/png') {
    return this.canvas.toDataURL(type);
  }

  // Load image from data URL onto canvas
  loadFromDataURL(dataURL) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.clear();
        this.ctx.drawImage(img, 0, 0);
        resolve();
      };
      img.onerror = reject;
      img.src = dataURL;
    });
  }
}
