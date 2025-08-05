// Alpine.js Terminal App Component
function terminalApp() {
    return {
        // State
        sessionId: null,
        isConnected: false,
        showingSessions: false,
        sessions: [],
        commandInput: '',
        
        // Terminal instances
        terminal: null,
        fitAddon: null,
        ws: null,
        reconnectAttempts: 0,
        
        // Constants
        MAX_RECONNECT_ATTEMPTS: 10,
        RECONNECT_BASE_DELAY: 1000,
        
        // Initialize
        init() {
            this.sessionId = this.getSessionIDFromURL();
            
            if (!this.sessionId) {
                this.showSessionList();
            } else {
                this.initializeTerminal();
            }
            
            // Handle browser navigation
            window.addEventListener('popstate', (event) => {
                if (event.state && event.state.sessionId) {
                    this.connectToSession(event.state.sessionId);
                } else if (event.state && event.state.sessionList) {
                    this.showSessionList();
                }
            });
            
            // Handle window resize
            window.addEventListener('resize', () => this.handleResize());
            
            // Handle visibility change
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden && this.terminal) {
                    this.terminal.focus();
                }
            });
        },
        
        // Utility functions
        getSessionIDFromURL() {
            const urlParams = new URLSearchParams(window.location.search);
            return urlParams.get('session');
        },
        
        updateURLWithSession(sessionId) {
            const url = new URL(window.location);
            url.searchParams.set('session', sessionId);
            window.history.pushState({ sessionId: sessionId }, '', url);
        },
        
        goBackToSessionList() {
            const url = new URL(window.location);
            url.searchParams.delete('session');
            window.history.pushState({ sessionList: true }, '', url);
            this.showSessionList();
        },
        
        // Terminal initialization
        initializeTerminal() {
            if (this.terminal) {
                this.terminal.dispose();
            }
            
            const { Terminal } = window;
            const { FitAddon } = window.FitAddon;
            
            this.terminal = new Terminal({
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
            
            this.fitAddon = new FitAddon();
            this.terminal.loadAddon(this.fitAddon);
            
            const terminalContainer = document.getElementById('terminal');
            this.terminal.open(terminalContainer);
            this.fitAddon.fit();
            
            // Handle terminal data
            this.terminal.onData((data) => {
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({
                        type: 'input',
                        data: data
                    }));
                }
            });
            
            this.connectWebSocket();
        },
        
        // WebSocket connection
        connectWebSocket() {
            const url = this.sessionId ? `ws://${window.location.host}?sessionID=${this.sessionId}` : `ws://${window.location.host}`;
            this.ws = new WebSocket(url);
            
            this.ws.onopen = () => {
                console.log('Connected to terminal');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                
                if (this.sessionId && this.terminal) {
                    this.terminal.clearTextureAtlas();
                    this.terminal.refresh(0, this.terminal.rows - 1);
                }
                
                this.ws.send(JSON.stringify({
                    type: 'resize',
                    cols: this.terminal.cols,
                    rows: this.terminal.rows
                }));
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    
                    switch (message.type) {
                        case 'output':
                            this.terminal.write(message.data);
                            break;
                        
                        case 'sessionID':
                            this.sessionId = message.sessionID;
                            this.updateURLWithSession(this.sessionId);
                            console.log(`Received new session ID: ${this.sessionId}`);
                            break;
                            
                        case 'exit':
                            console.log('Terminal session ended');
                            this.terminal.write('\r\n\x1b[31mSession ended. Reconnecting...\x1b[0m\r\n');
                            setTimeout(() => this.connectWebSocket(), 2000);
                            break;
                    }
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket connection closed');
                this.isConnected = false;
                
                if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
                    const delay = this.RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts);
                    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.MAX_RECONNECT_ATTEMPTS})`);
                    
                    setTimeout(() => {
                        this.reconnectAttempts++;
                        this.connectWebSocket();
                    }, delay);
                } else {
                    console.error('Max reconnection attempts reached');
                    if (this.terminal) {
                        this.terminal.write('\r\n\x1b[31mConnection lost. Please refresh the page.\x1b[0m\r\n');
                    }
                }
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.isConnected = false;
            };
        },
        
        // Session management
        async showSessionList() {
            this.showingSessions = true;
            try {
                const response = await fetch('/api/sessions');
                if (response.ok) {
                    this.sessions = await response.json();
                } else {
                    console.error('Failed to fetch sessions');
                    this.sessions = [];
                }
            } catch (error) {
                console.error('Error fetching sessions:', error);
                this.sessions = [];
            }
        },
        
        connectToSession(sessionId) {
            this.sessionId = sessionId;
            this.showingSessions = false;
            this.updateURLWithSession(sessionId);
            this.initializeTerminal();
        },
        
        async killSession(sessionId) {
            try {
                const response = await fetch(`/api/sessions/${sessionId}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    this.sessions = this.sessions.filter(s => s.id !== sessionId);
                    if (this.sessionId === sessionId) {
                        this.sessionId = null;
                        this.showSessionList();
                    }
                } else {
                    console.error('Failed to kill session');
                }
            } catch (error) {
                console.error('Error killing session:', error);
            }
        },
        
        createNewSession() {
            this.sessionId = null;
            this.showingSessions = false;
            this.initializeTerminal();
        },
        
        // Command handling
        sendCommand() {
            if (this.commandInput.trim() && this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'input',
                    data: this.commandInput + '\r'
                }));
                this.commandInput = '';
            }
        },
        
        sendKey(keyCode) {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                let keyData = '';
                switch (keyCode) {
                    case 27: keyData = '\x1b'; break; // Esc
                    case 9: keyData = '\t'; break; // Tab
                    case 17: keyData = '\x03'; break; // Ctrl+C
                    case 38: keyData = '\x1b[A'; break; // Up arrow
                    case 40: keyData = '\x1b[B'; break; // Down arrow
                    case 37: keyData = '\x1b[D'; break; // Left arrow
                    case 39: keyData = '\x1b[C'; break; // Right arrow
                }
                
                if (keyData) {
                    this.ws.send(JSON.stringify({
                        type: 'input',
                        data: keyData
                    }));
                }
            }
        },
        
        // Resize handling
        handleResize() {
            if (this.terminal && this.fitAddon) {
                this.fitAddon.fit();
                
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({
                        type: 'resize',
                        cols: this.terminal.cols,
                        rows: this.terminal.rows
                    }));
                }
            }
        }
    };
}