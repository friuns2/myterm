// Virtual keyboard module
export class VirtualKeyboard {
    constructor(terminalManager) {
        this.terminalManager = terminalManager;
        this.ctrlPressed = false;
    }

    initialize() {
        const virtualKeyboard = document.getElementById('virtual-keyboard');
        if (virtualKeyboard) {
            virtualKeyboard.addEventListener('click', (event) => {
                if (event.target.tagName === 'BUTTON') {
                    const keyCode = parseInt(event.target.dataset.keyCode);
                    this.handleVirtualKey(keyCode);
                }
            });
        }

        // Setup custom command input
        const customCommandInput = document.getElementById('custom-command-input');
        const sendCommandButton = document.getElementById('send-command-button');

        if (customCommandInput && sendCommandButton) {
            const sendCommand = () => {
                const command = customCommandInput.value;
                if (command.trim()) {
                    this.terminalManager.sendCommand(command);
                    customCommandInput.value = '';
                }
            };

            sendCommandButton.addEventListener('click', sendCommand);
            customCommandInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter') {
                    sendCommand();
                }
            });
        }
    }

    handleVirtualKey(keyCode) {
        if (!this.terminalManager.terminal) return;

        let keyToSend = '';
        
        switch (keyCode) {
            case 27: // Esc
                keyToSend = '\x1b';
                break;
            case 9: // Tab
                keyToSend = '\t';
                break;
            case 17: // Ctrl
                this.ctrlPressed = !this.ctrlPressed;
                // Visual feedback for Ctrl state
                const ctrlButton = document.querySelector('[data-key-code="17"]');
                if (ctrlButton) {
                    ctrlButton.classList.toggle('btn-active', this.ctrlPressed);
                }
                return;
            case 38: // Up arrow
                keyToSend = '\x1b[A';
                break;
            case 40: // Down arrow
                keyToSend = '\x1b[B';
                break;
            case 39: // Right arrow
                keyToSend = '\x1b[C';
                break;
            case 37: // Left arrow
                keyToSend = '\x1b[D';
                break;
            default:
                return;
        }

        if (keyToSend && this.terminalManager.ws && this.terminalManager.ws.readyState === WebSocket.OPEN) {
            this.terminalManager.ws.send(JSON.stringify({
                type: 'input',
                data: keyToSend
            }));
        }

        // Reset Ctrl state after sending a key (except for Ctrl itself)
        if (keyCode !== 17 && this.ctrlPressed) {
            this.ctrlPressed = false;
            const ctrlButton = document.querySelector('[data-key-code="17"]');
            if (ctrlButton) {
                ctrlButton.classList.remove('btn-active');
            }
        }
    }
}