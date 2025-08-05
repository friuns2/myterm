// Terminal initialization and configuration
class TerminalManager {
    constructor() {
        this.terminal = null;
        this.fitAddon = null;
        this.isInitialized = false;
    }

    init() {
        if (this.isInitialized) return this.terminal;

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
        this.isInitialized = true;

        return this.terminal;
    }

    mount(containerId) {
        if (!this.terminal) this.init();
        
        const container = document.getElementById(containerId);
        if (container) {
            this.terminal.open(container);
            this.fitAddon.fit();
        }
    }

    fit() {
        if (this.fitAddon) {
            this.fitAddon.fit();
        }
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

    onData(callback) {
        if (this.terminal) {
            this.terminal.onData(callback);
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

    get cols() {
        return this.terminal ? this.terminal.cols : 0;
    }

    get rows() {
        return this.terminal ? this.terminal.rows : 0;
    }
}

// Export for use in other modules
window.TerminalManager = TerminalManager;