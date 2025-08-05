// Terminal management module
export class TerminalManager {
    constructor() {
        this.terminal = null;
        this.fitAddon = null;
        this.ws = null;
        this.sessionID = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.MAX_RECONNECT_ATTEMPTS = 10;
        this.RECONNECT_BASE_DELAY = 1000;
    }

    initialize() {
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

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.terminal.onData((data) => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'input',
                    data: data
                }));
            }
        });

        window.addEventListener('resize', () => {
            if (this.fitAddon) {
                setTimeout(() => {
                    this.fitAddon.fit();
                    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                        this.ws.send(JSON.stringify({
                            type: 'resize',
                            cols: this.terminal.cols,
                            rows: this.terminal.rows
                        }));
                    }
                }, 100);
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.terminal) {
                this.terminal.focus();
            }
        });

        document.addEventListener('click', (event) => {
            if (event.target.closest('#terminal') && this.terminal) {
                this.terminal.focus();
            }
        });
    }

    connectWebSocket(sessionId) {
        this.sessionID = sessionId;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}?session=${sessionId}`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.terminal.focus();
        };
        
        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === 'output') {
                this.terminal.write(message.data);
            }
        };
        
        this.ws.onclose = () => {
            this.isConnected = false;
            if (this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
                this.reconnectAttempts++;
                const delay = this.RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts - 1);
                setTimeout(() => this.connectWebSocket(sessionId), delay);
            }
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    sendCommand(command) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'input',
                data: command + '\r'
            }));
        }
    }

    focus() {
        if (this.terminal) {
            this.terminal.focus();
        }
    }

    resize() {
        if (this.fitAddon) {
            this.fitAddon.fit();
        }
    }
}