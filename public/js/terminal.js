// Terminal initialization and management
class TerminalManager {
    constructor() {
        this.terminal = null;
        this.fitAddon = null;
        this.isInitialized = false;
    }

    initialize() {
        if (this.isInitialized) return;

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

        // Add fit addon for responsive sizing
        this.fitAddon = new FitAddon();
        this.terminal.loadAddon(this.fitAddon);

        // Mount terminal to DOM
        const terminalContainer = document.getElementById('terminal');
        this.terminal.open(terminalContainer);

        // Fit terminal to container
        this.fitAddon.fit();

        this.isInitialized = true;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Handle resize
        const handleResize = () => {
            if (this.fitAddon && this.terminal) {
                setTimeout(() => {
                    this.fitAddon.fit();
                    if (window.wsManager && window.wsManager.isConnected()) {
                        window.wsManager.sendResize(this.terminal.cols, this.terminal.rows);
                    }
                }, 100);
            }
        };

        window.addEventListener('resize', handleResize);

        // Handle visibility change
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.terminal) {
                this.terminal.focus();
            }
        });

        // Handle clicks to focus terminal
        document.addEventListener('click', (event) => {
            if (event.target.closest('#terminal') && this.terminal) {
                this.terminal.focus();
            }
        });

        // Handle terminal data input
        this.terminal.onData((data) => {
            if (window.wsManager && window.wsManager.isConnected()) {
                window.wsManager.sendInput(data);
            }
        });
    }

    write(data) {
        if (this.terminal) {
            this.terminal.write(data);
        }
    }

    clear() {
        if (this.terminal) {
            this.terminal.clear();
        }
    }

    focus() {
        if (this.terminal) {
            this.terminal.focus();
        }
    }

    getTerminal() {
        return this.terminal;
    }
}

// Export for global use
window.TerminalManager = TerminalManager;