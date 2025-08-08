// Terminal management functionality

// Initialize xterm.js terminal (from local shim)
const Terminal = window.Terminal;
const FitAddonCtor = window.FitAddon && window.FitAddon.FitAddon;

// Global variables for current terminal instance
let terminal = null;
let fitAddon = null;
let ws;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY = 1000; // 1 second
const WIDE_COLS = 240; // Desired wide column count to enable horizontal scroll

// Function to properly cleanup existing WebSocket connection
function cleanupWebSocket() {
    if (ws) {
        console.log('Cleaning up existing WebSocket connection');
        // Remove event listeners to prevent interference
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        ws.onerror = null;
        
        // Close the WebSocket if it's still open
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
        }
        ws = null;
    }
    isConnected = false;
    reconnectAttempts = 0;
}

// Function to create a new terminal instance
function createNewTerminal() {
    // Dispose of existing terminal if it exists
    if (terminal) {
        terminal.dispose();
    }
    
    // Create new terminal instance
    terminal = new Terminal({
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
    
    // Create new fit addon if available
    fitAddon = FitAddonCtor ? new FitAddonCtor() : null;
    if (fitAddon) {
        terminal.loadAddon(fitAddon);
    }
    
    return terminal;
}

const connectWebSocket = () => {
    // First, cleanup any existing WebSocket connection
    cleanupWebSocket();
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let url = `${protocol}//${window.location.host}`;
    
    const params = new URLSearchParams();
    if (sessionID) {
        params.append('sessionID', sessionID);
    }
    if (currentProject) {
        params.append('projectName', currentProject);
    }
    
    if (params.toString()) {
        url += `?${params.toString()}`;
    }
    
    console.log(`Connecting to WebSocket: ${url}`);
    ws = new WebSocket(url);

    ws.onopen = () => {
        console.log('Connected to terminal');
        isConnected = true;
        reconnectAttempts = 0; // Reset reconnect attempts on successful connection
        
        // Force screen refresh on reconnection
        if (sessionID) {
            // Clear texture atlas to force redraw
            terminal.clearTextureAtlas();
            // Refresh the entire terminal display
            terminal.refresh(0, terminal.rows - 1);
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
                    updateURLWithSession(sessionID, currentProject);
                    console.log(`Received new session ID: ${sessionID}`);
                    break;
                case 'error':
                    // Server rejected the connection due to missing/invalid session
                    console.error('Server error:', message.message);
                    terminal.write(`\r\nError: ${message.message}\r\n`);
                    terminal.write('Use Back to Sessions to return.\r\n');
                    isConnected = false;
                    // Do not attempt to reconnect on this error
                    reconnectAttempts = MAX_RECONNECT_ATTEMPTS;
                    try { ws.close(); } catch (e) {}
                    break;
                    
                case 'exit':
                    terminal.write(`\r\nProcess exited with code: ${message.exitCode}\r\n`);
                    terminal.write('Connection closed. Go back to session list.\r\n');
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
        isConnected = false;
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts);
            reconnectAttempts++;
            console.log(`Attempting to reconnect in ${delay / 1000} seconds... (Attempt ${reconnectAttempts})`);
            terminal.write(`\r\nConnection lost. Attempting to reconnect...\r\n`);
            setTimeout(connectWebSocket, delay);
        } else {
            terminal.write('\r\nConnection lost. Max reconnect attempts reached. Go back to session list.\r\n');
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        terminal.write('\r\nWebSocket error occurred. Attempting to reconnect.\r\n');
        ws.close(); // Force close to trigger onclose and reconnect logic
    };
};

// Function to initialize terminal
function initializeTerminal() {
    const terminalContainer = document.getElementById('terminal-container');
    terminalContainer.innerHTML = `
        <div class="flex flex-col h-full">
            <div id="terminal" class="flex-1"></div>
        </div>
    `;
    
    // Create a new terminal instance instead of reusing the old one
    createNewTerminal();
    
    // Mount new terminal to DOM element
    const newTerminalElement = document.getElementById('terminal');
    terminal.open(newTerminalElement);
    if (fitAddon) {
        // Perform an initial fit to size rows based on height, then widen columns
        fitAddon.fit();
    }

    // Disable automatic line wrapping (DECAWM off)
    // CSI ? 7 l — Reset mode 7 (Auto-Wrap) so long lines do not wrap
    terminal.write('\x1b[?7l');

    // Widen terminal columns to a fixed large value to allow horizontal scrolling
    // This must happen after open (and optional initial fit) so metrics are available
    try {
        terminal.resize(WIDE_COLS, terminal.rows);
    } catch (e) {
        console.warn('Resize to wide columns failed:', e);
    }
    
    // Set up terminal data handler for the new instance
    terminal.onData((data) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'input',
                data: data
            }));
        }
    });
    
    // Focus the new terminal instance
    terminal.focus();
    
    // Connect WebSocket
    connectWebSocket();
    
    // Show navigation bar when terminal is active
    showNavigationBar();
}

// Handle terminal resize
const handleResize = () => {
    // Adjust rows based on available height, preserve wide column count for horizontal scroll
    if (fitAddon && terminal) {
        const dims = fitAddon.proposeDimensions();
        if (dims && typeof dims.rows === 'number' && dims.rows > 0) {
            if (dims.rows !== terminal.rows) {
                terminal.resize(terminal.cols, dims.rows);
            }
        }
    }
    if (isConnected && terminal) {
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
    if (!document.hidden && terminal) {
        terminal.focus();
        
        // If we have a terminal but no connection, try to reconnect
        if (!isConnected) {
            console.log('Page visible again, reconnecting');
            connectWebSocket();
        }
    } else if (document.hidden) {
        // Page is being hidden, but don't cleanup completely
        // Just close WebSocket to free up resources on mobile/background tabs
        if (ws && ws.readyState === WebSocket.OPEN) {
            console.log('Page hidden, closing WebSocket');
            ws.close();
        }
    }
});

// Focus terminal when clicking anywhere
document.addEventListener('click', (event) => {
    // Only focus terminal if the click is not inside the custom input container
    const customInputContainer = document.getElementById('custom-input-container');
    if (customInputContainer && !customInputContainer.contains(event.target) && terminal) {
        terminal.focus();
    }
});

// Cleanup function to be called when navigating away from terminal
function cleanupTerminal() {
    cleanupWebSocket();
    if (terminal) {
        terminal.dispose();
        terminal = null;
    }
    if (fitAddon) {
        fitAddon = null;
    }
}

// Handle virtual keyboard geometry changes for better mobile experience
if ("virtualKeyboard" in navigator) {
    navigator.virtualKeyboard.addEventListener('geometrychange', (event) => {
        const { height } = event.target.boundingRect;
        console.log(`Virtual keyboard height changed: ${height}px`);
        
        // Trigger terminal resize after a short delay to ensure layout has updated
        setTimeout(() => {
            if (fitAddon && terminal) {
                const dims = fitAddon.proposeDimensions();
                if (dims && typeof dims.rows === 'number' && dims.rows > 0) {
                    if (dims.rows !== terminal.rows) {
                        terminal.resize(terminal.cols, dims.rows);
                    }
                }
                if (isConnected) {
                    ws.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }));
                }
                console.log('Terminal rows adjusted for virtual keyboard');
            }
        }, 100);
    });
}

// Ensure cleanup on page unload
window.addEventListener('beforeunload', () => {
    cleanupTerminal();
});