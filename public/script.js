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

let ws;
let sessionID = localStorage.getItem('terminalSessionID'); // Try to retrieve existing session ID
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY = 1000; // 1 second

const connectWebSocket = () => {
    const url = sessionID ? `ws://${window.location.host}?sessionID=${sessionID}` : `ws://${window.location.host}`;
    ws = new WebSocket(url);

    ws.onopen = () => {
        console.log('Connected to terminal');
        isConnected = true;
        reconnectAttempts = 0; // Reset reconnect attempts on successful connection
        
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
                
                case 'sessionID':
                    // Store session ID received from server
                    sessionID = message.sessionID;
                    localStorage.setItem('terminalSessionID', sessionID);
                    console.log(`Received new session ID: ${sessionID}`);
                    break;
                    
                case 'exit':
                    terminal.write(`\r\nProcess exited with code: ${message.exitCode}\r\n`);
                    terminal.write('Connection closed. Refresh to reconnect.\r\n');
                    isConnected = false;
                    // Optionally, clear session ID if process truly exited
                    localStorage.removeItem('terminalSessionID');
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
        isConnected = false;
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts);
            reconnectAttempts++;
            console.log(`Attempting to reconnect in ${delay / 1000} seconds... (Attempt ${reconnectAttempts})`);
            terminal.write(`\r\nConnection lost. Attempting to reconnect...\r\n`);
            setTimeout(connectWebSocket, delay);
        } else {
            terminal.write('\r\nConnection lost. Max reconnect attempts reached. Refresh to reconnect.\r\n');
            localStorage.removeItem('terminalSessionID'); // Clear session ID on max attempts
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        terminal.write('\r\nWebSocket error occurred. Attempting to reconnect.\r\n');
        ws.close(); // Force close to trigger onclose and reconnect logic
    };
};

// Initial WebSocket connection
connectWebSocket();

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