# Collaborative Canvas

A real-time multi-user drawing application built with React-style vanilla JavaScript, Node.js, and WebSockets. Multiple users can draw simultaneously on the same canvas with live synchronization, cursor tracking, and global undo/redo functionality.

## 🚀 Live Demo

**Try it now**: https://collaborativecanvas--MayankJyani.replit.app

Open the link in multiple browser windows or tabs to test real-time collaboration!

## Features

### Core Features
- **Real-time Drawing**: See other users' strokes stream live as they draw (start/append/end)
- **Drawing Tools**: Brush and eraser with customizable colors and stroke widths
- **User Indicators**: See where other users are currently drawing with cursor positions
- **Global Undo/Redo**: Works across all users with proper conflict resolution
- **User Management**: Shows who's online with color-coded indicators
- **Room System**: Support for multiple isolated drawing sessions

### Technical Highlights
- Raw Canvas API implementation (no drawing libraries)
- WebSocket-based real-time synchronization using Socket.io
- Efficient path rendering with quadratic curves for smooth lines
- Optimized event batching to reduce network overhead
- Client-side prediction for immediate visual feedback
- Operation history management for undo/redo functionality
- Touch support for mobile devices

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

```bash
# Clone or extract the project
cd collaborative-canvas

# Install dependencies
npm install

# Start the server
npm start
```

The server will start on `http://localhost:3000` by default.

### Testing with Multiple Users

To test the collaborative features:

1. Open `http://localhost:3000` in your first browser window
2. Open `http://localhost:3000` in a second browser window (or incognito mode)
3. Start drawing in either window - you'll see the drawings appear in real-time in both windows
4. Test undo/redo - it will affect both users' canvases
5. Try drawing simultaneously in both windows to test conflict resolution

### Using Different Rooms

To use separate drawing rooms, add a `?room=roomname` query parameter:

```
http://localhost:3000?room=room1
http://localhost:3000?room=room2
```

Users in different rooms won't see each other's drawings.

## Project Structure

```
collaborative-canvas/
├── client/
│   ├── index.html          # Main HTML file with UI structure
│   ├── style.css           # CSS styles for the application
│   ├── canvas.js           # Canvas drawing logic using raw Canvas API
│   ├── websocket.js        # WebSocket client for real-time communication
│   └── main.js             # Main application logic and UI integration
├── server/
│   ├── server.js           # Express + Socket.io server
│   ├── rooms.js            # Room management logic
│   └── drawing-state.js    # Canvas state and operation history management
├── package.json
├── README.md
└── ARCHITECTURE.md         # Technical architecture documentation
```

## Usage

### Drawing
- Click and drag on the canvas to draw
- Select brush or eraser from the toolbar
- Change colors using the color picker
- Adjust line width with the slider

### Keyboard Shortcuts
- `Ctrl+Z` (or `Cmd+Z` on Mac): Undo
- `Ctrl+Shift+Z` (or `Cmd+Shift+Z` on Mac): Redo

### Mobile Support
Touch events are supported for drawing on mobile devices.

## Configuration

You can configure the server port using environment variables:

```bash
PORT=8080 npm start
```

## Known Limitations

1. **No Persistence**: Canvas drawings are not saved to a database. When all users leave a room, the drawing is lost.
2. **Cursor Performance**: With many users (10+), cursor rendering may impact performance.
3. **History Size**: No limit on operation history - very long sessions might consume memory.
4. **Network Latency**: On high-latency connections, drawings may appear slightly delayed.

## Performance Considerations

- Cursor updates are throttled to 50ms intervals to reduce network traffic
- Stroke points are streamed in small batches (~16ms) for live rendering
- Drawing paths use quadratic curves for smooth rendering
- Client-side prediction provides immediate visual feedback
- Cursors render on a separate overlay canvas to avoid trails
- Canvas operations are optimized with proper context management

## Browser Compatibility

Tested and working on:
- Chrome/Edge (v90+)
- Firefox (v88+)
- Safari (v14+)

## Time Spent

Approximately 4-5 hours:
- Server architecture and WebSocket implementation: 1.5 hours
- Canvas drawing system with raw Canvas API: 1.5 hours
- Client integration and UI: 1 hour
- Testing and refinement: 0.5-1 hour
- Documentation: 0.5 hour

## Future Enhancements

Potential improvements that could be added:
- Drawing persistence with database storage
- More drawing tools (shapes, text, images)
- Canvas export/import functionality
- User authentication
- Performance metrics dashboard
- History size limits and compression
- WebRTC for peer-to-peer connections at scale

## License

MIT
