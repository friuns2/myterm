// Vue 2 Web Terminal Application
new Vue({
    el: '#app',
    data: {
        // View management
        currentView: 'sessionList', // 'sessionList' or 'terminal'
        
        // Session management
        sessions: [],
        currentSessionId: null,
        
        // Terminal
        terminal: null,
        fitAddon: null,
        
        // WebSocket
        ws: null,
        reconnectAttempts: 0,
        maxReconnectAttempts: 5,
        reconnectDelay: 1000,
        
        // Connection status
        connectionStatus: 'Disconnected',
        
        // UI
        customCommand: '',
        notifications: [],
        notificationId: 0,
        
        // Virtual keyboard keys
        virtualKeys: [
            { key: 'Escape', label: 'Esc' },
            { key: 'Tab', label: 'Tab' },
            { key: 'Ctrl+C', label: 'Ctrl+C' },
            { key: 'Ctrl+D', label: 'Ctrl+D' },
            { key: 'Ctrl+Z', label: 'Ctrl+Z' },
            { key: 'Up', label: '↑' },
            { key: 'Left', label: '←' },
            { key: 'Down', label: '↓' },
            { key: 'Right', label: '→' },
            { key: 'Enter', label: 'Enter' },
            { key: 'Backspace', label: '⌫' }
        ]
    },
    
    computed: {
        connectionStatusClass() {
            return {
                'bg-green-500 text-white': this.connectionStatus === 'Connected',
                'bg-red-500 text-white': this.connectionStatus === 'Disconnected',
                'bg-yellow-500 text-black': this.connectionStatus === 'Connecting'
            };
        }
    },
    
    mounted() {
        this.initializeApp();
    },
    
    methods: {
        // Application initialization
        initializeApp() {
            this.loadSessionsFromUrl();
            this.loadSessionList();
            
            // Handle browser navigation
            window.addEventListener('popstate', this.handlePopState);
            
            // Handle window resize for terminal
            window.addEventListener('resize', this.handleResize);
        },
        
        // Session management
        loadSessionsFromUrl() {
            const urlParams = new URLSearchParams(window.location.search);
            const sessionId = urlParams.get('session');
            
            if (sessionId) {
                this.currentSessionId = sessionId;
                this.currentView = 'terminal';
                this.$nextTick(() => {
                    this.initializeTerminal();
                    this.connectWebSocket(sessionId);
                });
            }
        },
        
        async loadSessionList() {
            try {
                const response = await fetch('/api/sessions');
                if (response.ok) {
                    this.sessions = await response.json();
                } else {
                    this.showNotification('Failed to load sessions', 'error');
                }
            } catch (error) {
                console.error('Error loading sessions:', error);
                this.showNotification('Error loading sessions', 'error');
            }
        },
        
        async createNewSession() {
            try {
                const response = await fetch('/api/sessions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const session = await response.json();
                    this.connectToSession(session.id);
                } else {
                    this.showNotification('Failed to create session', 'error');
                }
            } catch (error) {
                console.error('Error creating session:', error);
                this.showNotification('Error creating session', 'error');
            }
        },
        
        connectToSession(sessionId) {
            this.currentSessionId = sessionId;
            this.currentView = 'terminal';
            this.updateUrl(sessionId);
            
            this.$nextTick(() => {
                this.initializeTerminal();
                this.connectWebSocket(sessionId);
            });
        },
        
        goBackToSessionList() {
            this.currentView = 'sessionList';
            this.currentSessionId = null;
            this.updateUrl();
            this.disconnectWebSocket();
            this.destroyTerminal();
            this.loadSessionList();
        },
        
        updateUrl(sessionId = null) {
            const url = new URL(window.location);
            if (sessionId) {
                url.searchParams.set('session', sessionId);
            } else {
                url.searchParams.delete('session');
            }
            window.history.pushState({}, '', url);
        },
        
        handlePopState() {
            this.loadSessionsFromUrl();
        },
        
        // Terminal management
        initializeTerminal() {
            if (this.terminal) {
                this.destroyTerminal();
            }
            
            this.terminal = new Terminal({
                cursorBlink: true,
                fontSize: 14,
                fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                theme: {
                    background: '#000000',
                    foreground: '#ffffff'
                }
            });
            
            this.fitAddon = new FitAddon.FitAddon();
            this.terminal.loadAddon(this.fitAddon);
            
            const terminalElement = document.getElementById('terminal');
            if (terminalElement) {
                this.terminal.open(terminalElement);
                this.fitAddon.fit();
                
                // Handle terminal input
                this.terminal.onData(data => {
                    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                        this.ws.send(JSON.stringify({
                            type: 'input',
                            data: data
                        }));
                    }
                });
                
                // Handle terminal resize
                this.terminal.onResize(({ cols, rows }) => {
                    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                        this.ws.send(JSON.stringify({
                            type: 'resize',
                            cols: cols,
                            rows: rows
                        }));
                    }
                });
                
                this.terminal.focus();
            }
        },
        
        destroyTerminal() {
            if (this.terminal) {
                this.terminal.dispose();
                this.terminal = null;
            }
            if (this.fitAddon) {
                this.fitAddon = null;
            }
        },
        
        handleResize() {
            if (this.terminal && this.fitAddon) {
                setTimeout(() => {
                    this.fitAddon.fit();
                }, 100);
            }
        },
        
        // WebSocket management
        connectWebSocket(sessionId) {
            this.disconnectWebSocket();
            
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}?session=${sessionId}`;
            
            this.connectionStatus = 'Connecting';
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.connectionStatus = 'Connected';
                this.reconnectAttempts = 0;
                this.showNotification('Connected to terminal', 'success');
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleWebSocketMessage(message);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.connectionStatus = 'Disconnected';
                this.attemptReconnect();
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.connectionStatus = 'Disconnected';
                this.showNotification('Connection error', 'error');
            };
        },
        
        disconnectWebSocket() {
            if (this.ws) {
                this.ws.close();
                this.ws = null;
            }
            this.connectionStatus = 'Disconnected';
        },
        
        handleWebSocketMessage(message) {
            switch (message.type) {
                case 'output':
                    if (this.terminal && message.data) {
                        this.terminal.write(message.data);
                    }
                    break;
                    
                case 'session_id':
                    console.log('Session ID received:', message.sessionId);
                    break;
                    
                case 'exit':
                    this.showNotification('Terminal session ended', 'info');
                    setTimeout(() => {
                        this.goBackToSessionList();
                    }, 2000);
                    break;
                    
                default:
                    console.log('Unknown message type:', message.type);
            }
        },
        
        attemptReconnect() {
            if (this.reconnectAttempts < this.maxReconnectAttempts && this.currentView === 'terminal') {
                this.reconnectAttempts++;
                this.showNotification(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, 'warning');
                
                setTimeout(() => {
                    if (this.currentSessionId) {
                        this.connectWebSocket(this.currentSessionId);
                    }
                }, this.reconnectDelay * this.reconnectAttempts);
            } else {
                this.showNotification('Connection failed. Please try again.', 'error');
            }
        },
        
        // UI interactions
        sendCustomCommand() {
            if (this.customCommand.trim() && this.terminal) {
                this.terminal.write(this.customCommand + '\r');
                if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(JSON.stringify({
                        type: 'input',
                        data: this.customCommand + '\r'
                    }));
                }
                this.customCommand = '';
            }
        },
        
        sendVirtualKey(key) {
            if (!this.terminal) return;
            
            let keyData = '';
            
            switch (key) {
                case 'Escape':
                    keyData = '\x1b';
                    break;
                case 'Tab':
                    keyData = '\t';
                    break;
                case 'Ctrl+C':
                    keyData = '\x03';
                    break;
                case 'Ctrl+D':
                    keyData = '\x04';
                    break;
                case 'Ctrl+Z':
                    keyData = '\x1a';
                    break;
                case 'Up':
                    keyData = '\x1b[A';
                    break;
                case 'Down':
                    keyData = '\x1b[B';
                    break;
                case 'Right':
                    keyData = '\x1b[C';
                    break;
                case 'Left':
                    keyData = '\x1b[D';
                    break;
                case 'Enter':
                    keyData = '\r';
                    break;
                case 'Backspace':
                    keyData = '\x7f';
                    break;
                default:
                    keyData = key;
            }
            
            this.terminal.write(keyData);
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'input',
                    data: keyData
                }));
            }
        },
        
        // Notifications
        showNotification(message, type = 'info') {
            const notification = {
                id: this.notificationId++,
                message,
                type
            };
            
            this.notifications.push(notification);
            
            // Auto-remove notification after 3 seconds
            setTimeout(() => {
                const index = this.notifications.findIndex(n => n.id === notification.id);
                if (index > -1) {
                    this.notifications.splice(index, 1);
                }
            }, 3000);
        }
    },
    
    beforeDestroy() {
        this.disconnectWebSocket();
        this.destroyTerminal();
        window.removeEventListener('popstate', this.handlePopState);
        window.removeEventListener('resize', this.handleResize);
    }
});