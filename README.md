# Web Terminal with Buffer Output and Session Restoration

A web-based terminal emulator with comprehensive buffer management and session restoration capabilities.

## Features

### Core Terminal Features
- Full PTY support for interactive applications (nano, tmux, etc.)
- WebSocket-based real-time communication
- Responsive terminal sizing
- Virtual keyboard for mobile devices
- Custom command input field

### Buffer Management & Session Restoration
- **Automatic Buffer Capture**: All terminal output is automatically captured and stored
- **Session Persistence**: Sessions persist across browser refreshes and reconnections
- **Buffer Restoration**: When reconnecting to an existing session, the complete terminal history is restored
- **Periodic Saving**: Buffers are automatically saved every 5 seconds
- **Size Management**: Buffers are automatically trimmed when they exceed 1MB to maintain performance
- **Manual Buffer Clearing**: Users can manually clear the session buffer via the UI

### Session Management
- **Unique Session IDs**: Each terminal session gets a unique UUID
- **Automatic Reconnection**: Client automatically attempts to reconnect to existing sessions
- **Session Timeout**: Sessions are kept alive for 2 hours after disconnection
- **Cleanup**: Old session files (>7 days) are automatically cleaned up on server startup

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open your browser to `http://localhost:8086`

## Configuration

The server can be configured via `config.json`:

```json
{
  "server": {
    "port": 8086,
    "sessionTimeout": 7200000,
    "bufferSaveInterval": 5000,
    "maxBufferSize": 1048576,
    "sessionsDir": "./sessions",
    "cleanupMaxAge": 604800000
  },
  "terminal": {
    "defaultCols": 80,
    "defaultRows": 24,
    "shell": {
      "win32": "powershell.exe",
      "default": "bash"
    }
  },
  "features": {
    "bufferEnabled": true,
    "autoReconnect": true,
    "sessionPersistence": true
  }
}
```

## How Buffer Restoration Works

1. **Buffer Capture**: Every piece of output from the PTY process is captured and added to the session buffer
2. **Periodic Saving**: Buffers are saved to disk every 5 seconds and whenever significant events occur (disconnection, errors)
3. **Session Restoration**: When a client reconnects with an existing session ID:
   - The server checks if the session is still active in memory
   - If not, it loads the saved buffer from disk
   - The complete buffer is sent to the client with a `restore_buffer` message
   - The client clears the terminal and writes the restored buffer content

## API

### WebSocket Message Types

#### Client to Server
- `input`: Send input to the PTY process
- `resize`: Resize the terminal
- `clear_buffer`: Clear the session buffer

#### Server to Client
- `output`: PTY output data
- `sessionID`: Session ID assignment
- `restore_buffer`: Buffer content for restoration
- `buffer_cleared`: Confirmation that buffer was cleared
- `exit`: Process exit notification

## Testing

Run the buffer functionality test:
```bash
node test-buffer.js
```

This test will:
1. Create a new session and send commands
2. Wait for the buffer to be saved
3. Reconnect to the same session
4. Verify that the buffer is properly restored

## File Structure

- `server.js` - Main server with buffer management
- `public/script.js` - Client-side terminal and buffer handling
- `public/index.html` - Web interface
- `sessions/` - Directory containing session buffer files
- `test-buffer.js` - Buffer functionality test script
- `config.json` - Server configuration

## Session Files

Session files are stored in JSON format in the `sessions/` directory:

```json
{
  "sessionID": "uuid-here",
  "buffer": "terminal output content...",
  "timestamp": 1234567890123
}
```

## Dependencies

- `express` - Web server
- `ws` - WebSocket implementation
- `node-pty` - PTY support for interactive applications
- `uuid` - Session ID generation
- `xterm.js` - Terminal emulator frontend

## Browser Compatibility

- Chrome/Chromium 60+
- Firefox 55+
- Safari 11+
- Edge 79+
