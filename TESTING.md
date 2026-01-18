# Testing Guide

## Quick Test

1. Start the server:
```bash
npm start
```

2. Open two browser windows:
   - Window 1: `http://localhost:3000`
   - Window 2: `http://localhost:3000` (or use incognito mode)

3. Draw in Window 1 - you should see it appear in Window 2 in real-time

## Feature Testing Checklist

### Basic Drawing
- [ ] Click and drag to draw on canvas
- [ ] Drawing appears smooth with no lag
- [ ] Brush tool works
- [ ] Eraser tool removes previous drawings
- [ ] Color picker changes drawing color
- [ ] Line width slider changes stroke thickness

### Real-time Synchronization
- [ ] Open 2+ browser windows
- [ ] Drawing in one window appears in others immediately
- [ ] Multiple users can draw simultaneously
- [ ] No drawing conflicts or corruption

### Cursor Indicators
- [ ] See other users' cursor positions
- [ ] Cursors are color-coded by user
- [ ] Cursor indicator changes when user is drawing
- [ ] Cursors disappear when users are inactive

### User Management
- [ ] Users appear in the "Online Users" list
- [ ] Each user has a unique color
- [ ] User names are displayed correctly
- [ ] User count is accurate
- [ ] User is removed from list when they disconnect

### Global Undo/Redo
- [ ] Click Undo button (or Ctrl+Z)
- [ ] Last drawing operation is removed for ALL users
- [ ] Click Redo button (or Ctrl+Shift+Z)
- [ ] Previously undone operation reappears for ALL users
- [ ] Drawing after undo removes redo history
- [ ] Undo works with operations from different users

### Clear Canvas
- [ ] Click Clear button
- [ ] Confirmation dialog appears
- [ ] Canvas clears for ALL users
- [ ] Undo/redo history is cleared

### Room System
- [ ] Open `http://localhost:3000?room=room1`
- [ ] Open `http://localhost:3000?room=room2`
- [ ] Users in different rooms don't see each other
- [ ] Each room maintains separate state

### Keyboard Shortcuts
- [ ] Ctrl+Z (or Cmd+Z) triggers undo
- [ ] Ctrl+Shift+Z (or Cmd+Shift+Z) triggers redo

### Mobile/Touch Support
- [ ] Open on mobile device or use browser dev tools touch emulation
- [ ] Touch drawing works smoothly
- [ ] Pinch to zoom doesn't interfere
- [ ] Touch controls are responsive

### Window Resize
- [ ] Resize browser window
- [ ] Canvas resizes appropriately
- [ ] Existing drawings are preserved
- [ ] Drawing still works after resize

### Disconnect/Reconnect
- [ ] Stop the server while connected
- [ ] Client shows "Disconnected" status
- [ ] Restart server
- [ ] Client automatically reconnects
- [ ] Previous drawings are lost (expected behavior)

### Performance Testing
- [ ] Open 3+ browser windows
- [ ] Draw simultaneously in all windows
- [ ] Check for lag or stuttering
- [ ] Verify FPS remains at 60fps (use browser dev tools)
- [ ] Monitor network traffic (should be reasonable)

## Expected Behavior

### What Should Work
✅ Real-time drawing synchronization
✅ Smooth drawing with no visible lag
✅ Global undo/redo affecting all users
✅ Multiple users drawing simultaneously
✅ Cursor position indicators
✅ User join/leave notifications
✅ Different rooms are isolated
✅ Automatic reconnection

### Known Limitations
⚠️ No persistence - drawings lost when all users leave
⚠️ History grows unbounded in long sessions
⚠️ Cursor rendering may slow with 10+ users
⚠️ No authentication or access control
⚠️ Drawing during disconnect is lost

## Browser Testing

Test on these browsers:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

## Performance Benchmarks

Expected metrics on localhost:
- Drawing latency: < 50ms
- Canvas FPS: 60fps with 2-3 users
- Network traffic: 2-5KB/s per active drawer
- Memory usage: ~50MB + ~1KB per operation

## Common Issues

### Issue: Canvas appears blank
**Solution**: Check browser console for errors. Make sure server is running.

### Issue: Drawings don't sync
**Solution**: Verify both users are in the same room. Check network tab for WebSocket connection.

### Issue: High CPU usage
**Solution**: Limit number of concurrent users. This is expected with cursor animation.

### Issue: Server won't start
**Solution**: 
- Check if port 3000 is already in use
- Run `npm install` to ensure dependencies are installed
- Check Node.js version (requires v14+)

## Debugging

Enable verbose logging:
1. Open browser console (F12)
2. Check for WebSocket connection messages
3. Verify drawing events are being sent/received

Server logs:
- User connections/disconnections
- Drawing operations received
- Undo/redo operations
- Error messages

## Test Scenarios

### Scenario 1: Basic Collaboration
1. User A and User B join default room
2. User A draws a circle
3. User B sees circle appear
4. User B draws a square
5. Both users see both shapes

### Scenario 2: Global Undo
1. User A draws (operation 1)
2. User B draws (operation 2)
3. User C clicks undo
4. Operation 2 disappears for ALL users
5. User C clicks undo again
6. Operation 1 disappears for ALL users

### Scenario 3: Drawing After Undo
1. User A draws (operation 1)
2. User B draws (operation 2)
3. User A clicks undo (operation 2 hidden)
4. User B draws (operation 3)
5. Operation 2 is permanently removed
6. Only operations 1 and 3 exist

### Scenario 4: Room Isolation
1. User A joins room1
2. User B joins room2
3. User A draws
4. User B doesn't see User A's drawing
5. User C joins room1
6. User C sees User A's drawing

## Automated Testing (Future)

Recommended tests to implement:

```javascript
// Unit tests
- DrawingStateManager operations
- Room management logic
- Path rendering algorithms

// Integration tests
- WebSocket event handling
- State synchronization
- Undo/redo logic

// E2E tests (Playwright/Puppeteer)
- Multi-user drawing
- Cross-browser compatibility
- Performance under load
```

## Load Testing

For testing with many users, use tools like:
- Artillery.io
- k6
- Apache JMeter

Example Artillery config:
```yaml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - engine: socketio
    flow:
      - emit:
          channel: "join-room"
          data: 
            roomId: "test"
            userName: "LoadTest"
```

## Reporting Issues

When reporting bugs, include:
1. Browser and version
2. Steps to reproduce
3. Expected vs actual behavior
4. Screenshots if applicable
5. Console errors
6. Network tab (WebSocket frames)
