// Virtual keyboard module

// Function to send key to terminal
function sendKey(key) {
    const terminal = window.Terminal.getTerminal();
    if (!terminal) return;
    
    let data;
    
    switch (key) {
        case 'ctrl+c':
            data = '\x03'; // Ctrl+C
            break;
        case 'ctrl+d':
            data = '\x04'; // Ctrl+D
            break;
        case 'ctrl+z':
            data = '\x1a'; // Ctrl+Z
            break;
        case 'ctrl+l':
            data = '\x0c'; // Ctrl+L
            break;
        case 'tab':
            data = '\t';
            break;
        case 'enter':
            data = '\r';
            break;
        case 'escape':
            data = '\x1b';
            break;
        case 'backspace':
            data = '\x7f';
            break;
        case 'up':
            data = '\x1b[A';
            break;
        case 'down':
            data = '\x1b[B';
            break;
        case 'right':
            data = '\x1b[C';
            break;
        case 'left':
            data = '\x1b[D';
            break;
        case 'home':
            data = '\x1b[H';
            break;
        case 'end':
            data = '\x1b[F';
            break;
        case 'pageup':
            data = '\x1b[5~';
            break;
        case 'pagedown':
            data = '\x1b[6~';
            break;
        case 'delete':
            data = '\x1b[3~';
            break;
        case 'f1':
            data = '\x1bOP';
            break;
        case 'f2':
            data = '\x1bOQ';
            break;
        case 'f3':
            data = '\x1bOR';
            break;
        case 'f4':
            data = '\x1bOS';
            break;
        case 'f5':
            data = '\x1b[15~';
            break;
        case 'f6':
            data = '\x1b[17~';
            break;
        case 'f7':
            data = '\x1b[18~';
            break;
        case 'f8':
            data = '\x1b[19~';
            break;
        case 'f9':
            data = '\x1b[20~';
            break;
        case 'f10':
            data = '\x1b[21~';
            break;
        case 'f11':
            data = '\x1b[23~';
            break;
        case 'f12':
            data = '\x1b[24~';
            break;
        default:
            data = key;
    }
    
    // Send data to terminal
    if (window.WebSocketManager && window.WebSocketManager.isConnected()) {
        window.WebSocketManager.send({
            type: 'input',
            data: data
        });
    }
    
    // Focus terminal after a small delay
    setTimeout(() => {
        terminal.focus();
    }, 10);
}

// Function to toggle virtual keyboard
function toggleVirtualKeyboard() {
    const keyboard = document.getElementById('virtual-keyboard');
    if (keyboard.classList.contains('hidden')) {
        keyboard.classList.remove('hidden');
    } else {
        keyboard.classList.add('hidden');
    }
}

// Function to handle custom command input
function handleCustomCommand() {
    const input = document.getElementById('custom-command-input');
    const command = input.value;
    
    if (command.trim()) {
        // Send command to terminal
        if (window.WebSocketManager && window.WebSocketManager.isConnected()) {
            window.WebSocketManager.send({
                type: 'input',
                data: command + '\r'
            });
        }
        
        // Clear input
        input.value = '';
        
        // Focus terminal
        const terminal = window.Terminal.getTerminal();
        if (terminal) {
            setTimeout(() => {
                terminal.focus();
            }, 10);
        }
    }
}

// Function to setup keyboard event listeners
function setupKeyboardEventListeners() {
    // Custom command input enter key handler
    const customCommandInput = document.getElementById('custom-command-input');
    if (customCommandInput) {
        customCommandInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleCustomCommand();
            }
        });
    }
}

// Export keyboard functions
window.Keyboard = {
    sendKey,
    toggleVirtualKeyboard,
    handleCustomCommand,
    setupKeyboardEventListeners
};