// WebSocket connection and communication management
class WebSocketManager {
    constructor() {
        this.ws = null;
        this.sessionID = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.MAX_RECONNECT_ATTEMPTS = 10;
        this.RECONNECT_BASE_DELAY = 1000; // 1 second
    }

    connect(sessionID = null) {
        this.sessionID = sessionID;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}${sessionID ? `?sessionID=${sessionID}` : ''}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            
            // Send initial resize
            if (window.terminalManager && window.terminalManager.terminal) {
                const terminal = window.terminalManager.terminal;
                this.sendResize(terminal.cols, terminal.rows);
            }
        };
        
        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.isConnected = false;
            this.attemptReconnect();
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.isConnected = false;
        };
    }

    handleMessage(message) {
        switch (message.type) {
            case 'output':
                if (window.terminalManager) {
                    window.terminalManager.write(message.data);
                }
                break;
                
            case 'sessionID':
                this.sessionID = message.sessionID;
                if (window.sessionManager) {
                    window.sessionManager.updateURLWithSession(message.sessionID);
                }
                console.log('Session ID received:', message.sessionID);
                break;
                
            case 'exit':
                console.log('Process exited with code:', message.exitCode);
                if (window.terminalManager) {
                    window.terminalManager.write('\r\n\r\nProcess exited. Press any key to reconnect...\r\n');
                }
                this.isConnected = false;
                break;
                
            default:
                console.log('Unknown message type:', message.type);
        }
    }

    sendInput(data) {
        if (this.isConnected && this.ws) {
            this.ws.send(JSON.stringify({
                type: 'input',
                data: data
            }));
        }
    }

    sendResize(cols, rows) {
        if (this.isConnected && this.ws) {
            this.ws.send(JSON.stringify({
                type: 'resize',
                cols: cols,
                rows: rows
            }));
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
            const delay = this.RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts);
            console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.MAX_RECONNECT_ATTEMPTS})`);
            
            setTimeout(() => {
                this.reconnectAttempts++;
                this.connect(this.sessionID);
            }, delay);
        } else {
            console.error('Max reconnection attempts reached');
            if (window.terminalManager) {
                window.terminalManager.write('\r\n\r\nConnection lost. Please refresh the page.\r\n');
            }
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
            this.isConnected = false;
        }
    }

    isConnected() {
        return this.isConnected;
    }

    getSessionID() {
        return this.sessionID;
    }
}

// Export for global use
window.WebSocketManager = WebSocketManager;