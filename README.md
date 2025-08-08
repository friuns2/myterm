# Web Terminal Emulator with PTY Support

A compact Node.js web-based terminal emulator using WebSockets and PTY (pseudo-terminal) for full interactive application support.

## ✨ Key Features

- **Full PTY Support** - Real pseudo-terminal emulation using node-pty
- **Interactive Apps** - Compatible with nano, tmux, vim, htop, and more
- **ANSI Escape Codes** - Full terminal control sequences support via xterm.js
- **Real-time** - WebSocket communication for instant command execution
- **Terminal Resizing** - Automatic terminal size adjustment
- **Modern UI** - Browser-based interface with xterm.js terminal emulator

## 🚀 Supported Applications

✅ **Text Editors**: nano, pico, vim, emacs  
✅ **System Tools**: htop, top, ps, less, more  
✅ **Terminal Multiplexers**: tmux, screen  
✅ **Interactive Tools**: ssh, ftp, python REPL  
✅ **All Shell Features**: tab completion, command history, ctrl+c/z  

## Installation

1. **Clone the repository:**
```bash
git clone https://github.com/friuns2/web-terminal-emulator.git
cd web-terminal-emulator
```

2. **Install dependencies:**
```bash
npm install
```

3. **Run the terminal:**
```bash
npm start
```

4. **Open in browser:**
Navigate to http://localhost:3531

## Usage

### Web Terminal (Recommended)
```bash
npm start
```
Then open http://localhost:3531 in your browser

### Command Line Functions
```bash
npm run shell
```

## 🎯 Interactive Features

- **Full Keyboard Support** - All special keys, combinations (Ctrl+C, etc.)
- **ANSI Colors** - Full color terminal output support
- **Terminal Resizing** - Responsive terminal that adapts to window size
- **Session Persistence** - Maintains shell state across commands
- **Real-time Streaming** - Live output for long-running commands

## Technical Details

- **Backend**: Node.js with Express and WebSockets
- **PTY**: node-pty for real terminal emulation
- **Frontend**: xterm.js for proper terminal rendering
- **Transport**: WebSocket for bidirectional real-time communication

## API Functions

- `runCommandSync(command)` - Synchronous execution
- `runCommand(command, callback)` - Async with callback
- `runCommandAsync(command)` - Promise-based async

## Example

```javascript
const { runCommandSync, runCommandAsync } = require('./shell-executor');

// Sync
const result = runCommandSync('ls');
console.log(result);

// Async
runCommandAsync('pwd').then(result => console.log(result.stdout));
```

## Demo

Successfully tested with:
- `nano` - Full text editor functionality
- `ls -la` - Directory listings with colors
- `echo` commands with ANSI escape sequences
- Interactive command-line applications 