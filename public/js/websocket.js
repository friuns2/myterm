// WebSocket management module
class WebSocketManager {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.MAX_RECONNECT_ATTEMPTS = 10;
        this.RECONNECT_BASE_DELAY = 1000; // 1 second
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let url = `${protocol}//${window.location.host}`;
        
        const params = new URLSearchParams();
        if (window.appState.sessionID) {
            params.append('sessionID', window.appState.sessionID);
        }
        if (window.appState.currentProject) {
            params.append('projectName', window.appState.currentProject);
        }
        
        if (params.toString()) {
            url += `?${params.toString()}`;
        }
        
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log('Connected to terminal');
            this.isConnected = true;
            this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
            
            // Force screen refresh on reconnection
            if (window.appState.sessionID) {
                // Clear texture atlas to force redraw
                window.terminalManager.clearTextureAtlas();
                // Refresh the entire terminal display
                window.terminalManager.refresh();
            }
            
            // Send initial terminal size
            const terminal = window.terminalManager.getTerminal();
            if (terminal) {
                this.send({
                    type: 'resize',
                    cols: terminal.cols,
                    rows: terminal.rows
                });
            }
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                
                switch (message.type) {
                    case 'output':
                        // Write PTY output to terminal
                        window.terminalManager.write(message.data);
                        break;
                    
                    case 'sessionID':
                        // Store session ID received from server
                        window.appState.sessionID = message.sessionID;
                        window.urlManager.updateURLWithSession(message.sessionID, window.appState.currentProject);
                        console.log(`Received new session ID: ${message.sessionID}`);
                        break;
                        
                    case 'exit':
                        window.terminalManager.write(`\r\nProcess exited with code: ${message.exitCode}\r\n`);
                        window.terminalManager.write('Connection closed. Go back to session list.\r\n');
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
                window.terminalManager.write(`\r\nConnection lost. Attempting to reconnect...\r\n`);
                setTimeout(() => this.connect(), delay);
            } else {
                window.terminalManager.write('\r\nConnection lost. Max reconnect attempts reached. Go back to session list.\r\n');
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            window.terminalManager.write('\r\nWebSocket error occurred. Attempting to reconnect.\r\n');
            this.ws.close(); // Force close to trigger onclose and reconnect logic
        };
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    isConnected() {
        return this.isConnected;
    }

    close() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

// Create global instance
window.wsManager = new WebSocketManager();