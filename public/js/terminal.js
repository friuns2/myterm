// Terminal management module
class TerminalManager {
    constructor() {
        this.terminal = null;
        this.fitAddon = null;
    }

    createNewTerminal() {
        // Dispose of existing terminal if it exists
        if (this.terminal) {
            this.terminal.dispose();
        }
        
        // Create new terminal instance
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
        
        // Create new fit addon
        this.fitAddon = new FitAddon();
        this.terminal.loadAddon(this.fitAddon);
        
        return this.terminal;
    }

    initializeTerminal() {
        const terminalContainer = document.getElementById('terminal-container');
        terminalContainer.innerHTML = `
            <div class="flex flex-col h-full">
                <div id="terminal" class="flex-1"></div>
            </div>
        `;
        
        // Create a new terminal instance instead of reusing the old one
        this.createNewTerminal();
        
        // Mount new terminal to DOM element
        const newTerminalElement = document.getElementById('terminal');
        this.terminal.open(newTerminalElement);
        this.fitAddon.fit();
        
        // Set up terminal data handler for the new instance
        this.terminal.onData((data) => {
            if (window.wsManager && window.wsManager.isConnected()) {
                window.wsManager.send({
                    type: 'input',
                    data: data
                });
            }
        });
        
        // Focus the new terminal instance
        this.terminal.focus();
        
        // Connect WebSocket
        window.wsManager.connect();
        
        // Show navigation bar when terminal is active
        window.uiManager.showNavigationBar();
    }

    write(data) {
        if (this.terminal) {
            this.terminal.write(data);
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
        if (window.wsManager && window.wsManager.isConnected() && this.terminal) {
            window.wsManager.send({
                type: 'resize',
                cols: this.terminal.cols,
                rows: this.terminal.rows
            });
        }
    }

    clearTextureAtlas() {
        if (this.terminal) {
            this.terminal.clearTextureAtlas();
        }
    }

    refresh() {
        if (this.terminal) {
            this.terminal.refresh(0, this.terminal.rows - 1);
        }
    }

    getTerminal() {
        return this.terminal;
    }
}

// Create global instance
window.terminalManager = new TerminalManager();