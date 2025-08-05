// WebSocket communication module

let ws;
let isConnected = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_BASE_DELAY = 1000; // 1 second

const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('WebSocket connected');
        isConnected = true;
        reconnectAttempts = 0;
        
        // Send session info if available
        if (window.URLModule && window.URLModule.getSessionIDFromURL()) {
            ws.send(JSON.stringify({
                type: 'join_session',
                sessionId: window.URLModule.getSessionIDFromURL(),
                projectName: window.URLModule.getProjectFromURL()
            }));
        } else if (window.URLModule && window.URLModule.getProjectFromURL()) {
            // Create new session for project
            ws.send(JSON.stringify({
                type: 'create_session',
                projectName: window.URLModule.getProjectFromURL()
            }));
        } else {
            // Create new session without project
            ws.send(JSON.stringify({
                type: 'create_session'
            }));
        }
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'session_created') {
                console.log('Session created:', data.sessionId);
                window.sessionID = data.sessionId;
                if (window.URLModule) {
                    window.URLModule.updateURLWithSession(data.sessionId, window.currentProject);
                }
            } else if (data.type === 'session_joined') {
                console.log('Session joined:', data.sessionId);
                window.sessionID = data.sessionId;
            } else if (data.type === 'output') {
                const terminal = window.TerminalModule?.getTerminal();
                if (terminal && data.data) {
                    terminal.write(data.data);
                }
            } else if (data.type === 'error') {
                console.error('WebSocket error:', data.message);
                if (data.message.includes('Session not found')) {
                    // Session doesn't exist, create a new one
                    ws.send(JSON.stringify({
                        type: 'create_session',
                        projectName: window.currentProject
                    }));
                }
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    };
    
    ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        isConnected = false;
        
        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            const delay = RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts);
            console.log(`Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
            
            setTimeout(() => {
                reconnectAttempts++;
                connectWebSocket();
            }, delay);
        } else {
            console.error('Max reconnection attempts reached. Please refresh the page.');
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
    
    // Handle terminal input
    const terminal = window.TerminalModule?.getTerminal();
    if (terminal) {
        terminal.onData((data) => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'input',
                    data: data,
                    sessionId: window.sessionID
                }));
            }
        });
    }
};

function sendCommand(command) {
    if (ws && ws.readyState === WebSocket.OPEN && window.sessionID) {
        ws.send(JSON.stringify({
            type: 'input',
            data: command + '\r',
            sessionId: window.sessionID
        }));
    }
}

function sendVirtualKey(data) {
    if (ws && ws.readyState === WebSocket.OPEN && window.sessionID) {
        ws.send(JSON.stringify({
            type: 'input',
            data: data,
            sessionId: window.sessionID
        }));
    }
}

// Export functions for use in other modules
window.WebSocketModule = {
    connectWebSocket,
    sendCommand,
    sendVirtualKey,
    isConnected: () => isConnected,
    getWebSocket: () => ws
};