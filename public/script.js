// Initialize xterm.js terminal
const { Terminal } = window;
const { FitAddon } = window.FitAddon;

const terminal = new Terminal({
    cursorBlink: true,
    fontFamily: 'Courier New, monospace',
    fontSize: 14,
    theme: {
        background: '#000000',
        foreground: '#00ff00',
        cursor: '#00ff00',
        cursorAccent: '#000000',
        selection: 'rgba(0, 255, 0, 0.3)'
    },
    allowTransparency: false
});

// Add fit addon for responsive sizing
const fitAddon = new FitAddon();
terminal.loadAddon(fitAddon);

// Mount terminal to DOM
const terminalContainer = document.getElementById('terminal');
terminal.open(terminalContainer);

// Fit terminal to container
fitAddon.fit();

// WebSocket connection
const ws = new WebSocket(`ws://${window.location.host}`);

let isConnected = false;

ws.onopen = () => {
    console.log('Connected to terminal');
    isConnected = true;
    
    // Send initial terminal size
    ws.send(JSON.stringify({
        type: 'resize',
        cols: terminal.cols,
        rows: terminal.rows
    }));
};

ws.onmessage = (event) => {
    try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
            case 'output':
                // Write PTY output to terminal
                terminal.write(message.data);
                break;
                
            case 'exit':
                terminal.write(`\r\nProcess exited with code: ${message.exitCode}\r\n`);
                terminal.write('Connection closed. Refresh to reconnect.\r\n');
                isConnected = false;
                break;
                
            default:
                console.log('Unknown message type:', message.type);
        }
    } catch (error) {
        console.error('Error parsing message:', error);
    }
};

ws.onclose = () => {
    console.log('WebSocket connection closed');
    if (isConnected) {
        terminal.write('\r\nConnection lost. Refresh to reconnect.\r\n');
    }
    isConnected = false;
};

ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    terminal.write('\r\nWebSocket error occurred.\r\n');
};

// Handle terminal input
terminal.onData((data) => {
    if (isConnected) {
        ws.send(JSON.stringify({
            type: 'input',
            data: data
        }));
    }
});

// Handle terminal resize
const handleResize = () => {
    fitAddon.fit();
    if (isConnected) {
        ws.send(JSON.stringify({
            type: 'resize',
            cols: terminal.cols,
            rows: terminal.rows
        }));
    }
};

// Resize terminal when window resizes
window.addEventListener('resize', handleResize);

// Handle visibility change (focus/blur)
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        terminal.focus();
    }
});

// Focus terminal when clicking anywhere
document.addEventListener('click', () => {
    terminal.focus();
});

// Initial focus
terminal.focus();