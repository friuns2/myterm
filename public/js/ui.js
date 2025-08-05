// UI components and interactions
class UIManager {
    constructor() {
        this.isInitialized = false;
    }

    initialize() {
        if (this.isInitialized) return;
        
        this.setupCustomCommandInput();
        this.setupVirtualKeyboard();
        
        this.isInitialized = true;
    }

    setupCustomCommandInput() {
        const customCommandInput = document.getElementById('custom-command-input');
        const sendCommandButton = document.getElementById('send-command-button');

        if (customCommandInput && sendCommandButton) {
            const sendCommand = () => {
                const command = customCommandInput.value;
                if (command && window.wsManager && window.wsManager.isConnected()) {
                    window.wsManager.sendInput(command + '\r');
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

    setupVirtualKeyboard() {
        const virtualKeyboard = document.getElementById('virtual-keyboard');
        if (virtualKeyboard) {
            virtualKeyboard.addEventListener('click', (event) => {
                if (event.target.classList.contains('key')) {
                    const key = event.target.getAttribute('data-key');
                    if (key && window.wsManager && window.wsManager.isConnected()) {
                        let keyToSend = key;
                        
                        // Handle special keys
                        switch (key) {
                            case 'Enter':
                                keyToSend = '\r';
                                break;
                            case 'Tab':
                                keyToSend = '\t';
                                break;
                            case 'Backspace':
                                keyToSend = '\b';
                                break;
                            case 'Escape':
                                keyToSend = '\x1b';
                                break;
                            case 'Space':
                                keyToSend = ' ';
                                break;
                            case 'Up':
                                keyToSend = '\x1b[A';
                                break;
                            case 'Down':
                                keyToSend = '\x1b[B';
                                break;
                            case 'Right':
                                keyToSend = '\x1b[C';
                                break;
                            case 'Left':
                                keyToSend = '\x1b[D';
                                break;
                            case 'Ctrl+C':
                                keyToSend = '\x03';
                                break;
                            case 'Ctrl+D':
                                keyToSend = '\x04';
                                break;
                            case 'Ctrl+Z':
                                keyToSend = '\x1a';
                                break;
                        }
                        
                        window.wsManager.sendInput(keyToSend);
                    }
                }
            });
        }
    }

    // Show/hide virtual keyboard
    toggleVirtualKeyboard() {
        const virtualKeyboard = document.getElementById('virtual-keyboard');
        if (virtualKeyboard) {
            virtualKeyboard.style.display = virtualKeyboard.style.display === 'none' ? 'block' : 'none';
        }
    }

    // Show/hide custom command input
    toggleCustomCommandInput() {
        const customCommandContainer = document.getElementById('custom-command-container');
        if (customCommandContainer) {
            customCommandContainer.style.display = customCommandContainer.style.display === 'none' ? 'block' : 'none';
        }
    }

    // Update UI state based on connection status
    updateConnectionStatus(isConnected) {
        const statusIndicator = document.getElementById('connection-status');
        if (statusIndicator) {
            statusIndicator.textContent = isConnected ? 'Connected' : 'Disconnected';
            statusIndicator.className = isConnected ? 'connected' : 'disconnected';
        }
    }

    // Show notification message
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
}

// Export for global use
window.UIManager = UIManager;