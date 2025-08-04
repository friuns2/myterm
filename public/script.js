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
        
        // Show reconnection status if this is a reconnect with existing session
        if (sessionID) {
            terminal.write('\r\n\x1b[32m[Reconnected - restoring session...]\x1b[0m\r\n');
        }
        
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
                
                case 'restore':
                    // Clear terminal and restore buffered content
                    terminal.clear();
                    terminal.write(message.data);
                    console.log('Terminal content restored from buffer');
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
document.addEventListener('click', (event) => {
    // Only focus terminal if the click is not inside the custom input container
    const customInputContainer = document.getElementById('custom-input-container');
    if (customInputContainer && !customInputContainer.contains(event.target)) {
        terminal.focus();
    }
});

// Initial focus
terminal.focus();

// Custom input field handling
const customCommandInput = document.getElementById('custom-command-input');
const sendCommandButton = document.getElementById('send-command-button');

if (customCommandInput && sendCommandButton) {
    const sendCommand = () => {
        const command = customCommandInput.value + '\r'; // Add carriage return to simulate Enter
        if (isConnected) {
            ws.send(JSON.stringify({
                type: 'input',
                data: command
            }));
            customCommandInput.value = ''; // Clear input after sending
        }
    };

    sendCommandButton.addEventListener('click', sendCommand);
    customCommandInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            sendCommand();
        }
    });
}

// Virtual keyboard input
const virtualKeyboard = document.getElementById('virtual-keyboard');
if (virtualKeyboard) {
    virtualKeyboard.addEventListener('click', (event) => {
        const button = event.target.closest('.key-button');
        if (button) {
            const keyCode = parseInt(button.dataset.keyCode, 10);
            let data = '';

            switch (keyCode) {
                case 27: // Esc
                    data = '\x1B';
                    break;
                case 9: // Tab
                    data = '\x09';
                    break;
                case 17: // Ctrl
                    // Prompt user for the next key
                    const nextKey = prompt("Enter next key for Ctrl combination (e.g., 'c' for Ctrl+C, 'z' for Ctrl+Z):");
                    if (nextKey) {
                        const charCode = nextKey.toLowerCase().charCodeAt(0);
                        if (charCode >= 97 && charCode <= 122) { // 'a' through 'z'
                            data = String.fromCharCode(charCode - 96); // Convert to Ctrl+A to Ctrl+Z
                        } else if (nextKey === '[') {
                            data = '\x1B'; // Ctrl+[ is Esc
                        } else if (nextKey === '\\') {
                            data = '\x1C'; // Ctrl+\ is FS (File Separator)
                        } else if (nextKey === ']') {
                            data = '\x1D'; // Ctrl+] is GS (Group Separator)
                        } else if (nextKey === '^') {
                            data = '\x1E'; // Ctrl+^ is RS (Record Separator)
                        } else if (nextKey === '_') {
                            data = '\x1F'; // Ctrl+_ is US (Unit Separator)
                        }
                    }
                    break;
                case 3: // Ctrl+C (ASCII End-of-Text character)
                    data = '\x03';
                    break;
                case 38: // Up Arrow
                    data = '\x1B[A';
                    break;
                case 40: // Down Arrow
                    data = '\x1B[B';
                    break;
                case 37: // Left Arrow
                    data = '\x1B[D';
                    break;
                case 39: // Right Arrow
                    data = '\x1B[C';
                    break;
                default:
                    // For other keys, if we add them, we'd map them here.
                    break;
            }

            if (isConnected && data) {
                ws.send(JSON.stringify({
                    type: 'input',
                    data: data
                }));
            }
        }
    });
}