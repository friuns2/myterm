// WebSocket communication module

// WebSocket connection variables
let ws;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY = 1000; // 1 second

// Function to connect WebSocket
const connectWebSocket = () => {
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
    
    ws = new WebSocket(url);

    ws.onopen = () => {
        console.log('Connected to terminal');
        isConnected = true;
        reconnectAttempts = 0; // Reset reconnect attempts on successful connection
        
        // Force screen refresh on reconnection
        if (sessionID) {
            const terminal = window.terminalModule.getTerminal();
            if (terminal) {
                // Clear texture atlas to force redraw
                terminal.clearTextureAtlas();
                // Refresh the entire terminal display
                terminal.refresh(0, terminal.rows - 1);
            }
        }
        
        // Send initial terminal size
        const terminal = window.terminalModule.getTerminal();
        if (terminal) {
            ws.send(JSON.stringify({
                type: 'resize',
                cols: terminal.cols,
                rows: terminal.rows
            }));
        }
    };

    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            
            switch (message.type) {
                case 'output':
                    // Write PTY output to terminal
                    const terminal = window.terminalModule.getTerminal();
                    if (terminal) {
                        terminal.write(message.data);
                    }
                    break;
                
                case 'sessionID':
                    // Store session ID received from server
                    sessionID = message.sessionID;
                    window.urlUtils.updateURLWithSession(sessionID, currentProject);
                    console.log(`Received new session ID: ${sessionID}`);
                    break;
                    
                case 'exit':
                    const terminalInstance = window.terminalModule.getTerminal();
                    if (terminalInstance) {
                        terminalInstance.write(`\r\nProcess exited with code: ${message.exitCode}\r\n`);
                        terminalInstance.write('Connection closed. Go back to session list.\r\n');
                    }
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
            const terminal = window.terminalModule.getTerminal();
            if (terminal) {
                terminal.write(`\r\nConnection lost. Attempting to reconnect...\r\n`);
            }
            setTimeout(connectWebSocket, delay);
        } else {
            const terminal = window.terminalModule.getTerminal();
            if (terminal) {
                terminal.write('\r\nConnection lost. Max reconnect attempts reached. Go back to session list.\r\n');
            }
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        const terminal = window.terminalModule.getTerminal();
        if (terminal) {
            terminal.write('\r\nWebSocket error occurred. Attempting to reconnect.\r\n');
        }
        ws.close(); // Force close to trigger onclose and reconnect logic
    };
};

// Function to send data through WebSocket
function sendWebSocketData(data) {
    if (isConnected && ws) {
        ws.send(JSON.stringify(data));
    }
}

// Export functions for use in other modules
window.webSocketModule = {
    connectWebSocket,
    sendWebSocketData,
    isConnected: () => isConnected,
    getWebSocket: () => ws
};