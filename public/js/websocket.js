// WebSocket connection management
class WebSocketManager {
    constructor(terminalManager) {
        this.terminalManager = terminalManager;
        this.ws = null;
        this.sessionID = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.MAX_RECONNECT_ATTEMPTS = 10;
        this.RECONNECT_BASE_DELAY = 1000;
        this.onSessionIDReceived = null;
    }

    connect(sessionID = null) {
        this.sessionID = sessionID;
        const url = sessionID ? `ws://${window.location.host}?sessionID=${sessionID}` : `ws://${window.location.host}`;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log('Connected to terminal');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            
            if (this.sessionID) {
                this.terminalManager.clearTextureAtlas();
                this.terminalManager.refresh();
            }
            
            this.sendResize();
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                
                switch (message.type) {
                    case 'output':
                        this.terminalManager.write(message.data);
                        break;
                    
                    case 'sessionID':
                        this.sessionID = message.sessionID;
                        if (this.onSessionIDReceived) {
                            this.onSessionIDReceived(message.sessionID);
                        }
                        console.log(`Received new session ID: ${message.sessionID}`);
                        break;
                        
                    case 'exit':
                        this.terminalManager.write(`\r\nProcess exited with code: ${message.exitCode}\r\n`);
                        this.terminalManager.write('Connection closed. Go back to session list.\r\n');
                        this.isConnected = false;
                        break;
                        
                    default:
                        console.log('Unknown message type:', message.type);
                }
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket connection closed');
            this.isConnected = false;
            if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
                const delay = this.RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts);
                this.reconnectAttempts++;
                console.log(`Attempting to reconnect in ${delay / 1000} seconds... (Attempt ${this.reconnectAttempts})`);
                this.terminalManager.write(`\r\nConnection lost. Attempting to reconnect...\r\n`);
                setTimeout(() => this.connect(this.sessionID), delay);
            } else {
                this.terminalManager.write('\r\nConnection lost. Max reconnect attempts reached. Go back to session list.\r\n');
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.terminalManager.write('\r\nWebSocket error occurred. Attempting to reconnect.\r\n');
            this.ws.close();
        };
    }

    sendInput(data) {
        if (this.isConnected && this.ws) {
            this.ws.send(JSON.stringify({
                type: 'input',
                data: data
            }));
        }
    }

    sendResize() {
        if (this.isConnected && this.ws) {
            this.ws.send(JSON.stringify({
                type: 'resize',
                cols: this.terminalManager.cols,
                rows: this.terminalManager.rows
            }));
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.isConnected = false;
    }

    setSessionIDCallback(callback) {
        this.onSessionIDReceived = callback;
    }
}

// Export for use in other modules
window.WebSocketManager = WebSocketManager;