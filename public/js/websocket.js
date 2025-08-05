// WebSocket management module

let ws;
let sessionID = window.Utils.getSessionIDFromURL();
let currentProject = window.Utils.getProjectFromURL() || null;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY = 1000; // 1 second

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
        
        const terminal = window.Terminal.getTerminal();
        // Force screen refresh on reconnection
        if (sessionID && terminal) {
            // Clear texture atlas to force redraw
            terminal.clearTextureAtlas();
            // Refresh the entire terminal display
            terminal.refresh(0, terminal.rows - 1);
        }
        
        // Send initial terminal size
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
            const terminal = window.Terminal.getTerminal();
            
            switch (message.type) {
                case 'output':
                    // Write PTY output to terminal
                    if (terminal) {
                        terminal.write(message.data);
                    }
                    break;
                
                case 'sessionID':
                    // Store session ID received from server
                    sessionID = message.sessionID;
                    window.Utils.updateURLWithSession(sessionID, currentProject);
                    console.log(`Received new session ID: ${sessionID}`);
                    break;
                    
                case 'exit':
                    if (terminal) {
                        terminal.write(`\r\nProcess exited with code: ${message.exitCode}\r\n`);
                        terminal.write('Connection closed. Go back to session list.\r\n');
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
        const terminal = window.Terminal.getTerminal();
        
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts);
            reconnectAttempts++;
            console.log(`Attempting to reconnect in ${delay / 1000} seconds... (Attempt ${reconnectAttempts})`);
            if (terminal) {
                terminal.write(`\r\nConnection lost. Attempting to reconnect...\r\n`);
            }
            setTimeout(connectWebSocket, delay);
        } else {
            if (terminal) {
                terminal.write('\r\nConnection lost. Max reconnect attempts reached. Go back to session list.\r\n');
            }
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        const terminal = window.Terminal.getTerminal();
        if (terminal) {
            terminal.write('\r\nWebSocket error occurred. Attempting to reconnect.\r\n');
        }
        ws.close(); // Force close to trigger onclose and reconnect logic
    };
};

// Send data through WebSocket
function send(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

// Check if WebSocket is connected
function getIsConnected() {
    return isConnected;
}

// Get current session ID
function getSessionID() {
    return sessionID;
}

// Set session ID
function setSessionID(id) {
    sessionID = id;
}

// Get current project
function getCurrentProject() {
    return currentProject;
}

// Set current project
function setCurrentProject(project) {
    currentProject = project;
}

// Export WebSocket functions
window.WebSocketManager = {
    connect: connectWebSocket,
    send,
    isConnected: getIsConnected,
    getSessionID,
    setSessionID,
    getCurrentProject,
    setCurrentProject
};