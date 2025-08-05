// UI interaction management
class UIManager {
    constructor(terminalManager, webSocketManager) {
        this.terminalManager = terminalManager;
        this.webSocketManager = webSocketManager;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Handle terminal input
        this.terminalManager.onData((data) => {
            this.webSocketManager.sendInput(data);
        });

        // Handle terminal resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        // Handle visibility change (focus/blur)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.terminalManager.focus();
            }
        });

        // Focus terminal when clicking anywhere
        document.addEventListener('click', (event) => {
            const customInputContainer = document.getElementById('custom-input-container');
            if (customInputContainer && !customInputContainer.contains(event.target)) {
                this.terminalManager.focus();
            }
        });
    }

    handleResize() {
        this.terminalManager.fit();
        this.webSocketManager.sendResize();
    }

    setupCustomCommandInput() {
        const customCommandInput = document.getElementById('custom-command-input');
        const sendCommandButton = document.getElementById('send-command-button');

        if (customCommandInput && sendCommandButton) {
            const sendCommand = () => {
                const command = customCommandInput.value + '\r';
                this.webSocketManager.sendInput(command);
                customCommandInput.value = '';
            };

            sendCommandButton.addEventListener('click', sendCommand);
            customCommandInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    sendCommand();
                }
            });
        }
    }

    setupVirtualKeyboard() {
        const virtualKeyboard = document.getElementById('virtual-keyboard');
        if (virtualKeyboard) {
            virtualKeyboard.addEventListener('click', (event) => {
                const button = event.target.closest('button[data-key-code]');
                if (button) {
                    const keyCode = parseInt(button.dataset.keyCode, 10);
                    const data = this.getKeyData(keyCode);
                    
                    if (data) {
                        this.webSocketManager.sendInput(data);
                    }
                }
            });
        }
    }

    getKeyData(keyCode) {
        switch (keyCode) {
            case 27: // Esc
                return '\x1B';
            case 9: // Tab
                return '\x09';
            case 17: // Ctrl
                const nextKey = prompt("Enter next key for Ctrl combination (e.g., 'c' for Ctrl+C, 'z' for Ctrl+Z):");
                if (nextKey) {
                    const charCode = nextKey.toLowerCase().charCodeAt(0);
                    if (charCode >= 97 && charCode <= 122) {
                        return String.fromCharCode(charCode - 96);
                    } else if (nextKey === '[') {
                        return '\x1B';
                    } else if (nextKey === '\\') {
                        return '\x1C';
                    } else if (nextKey === ']') {
                        return '\x1D';
                    } else if (nextKey === '^') {
                        return '\x1E';
                    } else if (nextKey === '_') {
                        return '\x1F';
                    }
                }
                return null;
            case 3: // Ctrl+C
                return '\x03';
            case 38: // Up Arrow
                return '\x1B[A';
            case 40: // Down Arrow
                return '\x1B[B';
            case 37: // Left Arrow
                return '\x1B[D';
            case 39: // Right Arrow
                return '\x1B[C';
            default:
                return null;
        }
    }

    focusTerminal() {
        this.terminalManager.focus();
    }

    initializeUIComponents() {
        this.setupCustomCommandInput();
        this.setupVirtualKeyboard();
        this.focusTerminal();
    }
}

// Export for use in other modules
window.UIManager = UIManager;