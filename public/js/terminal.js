// Terminal management module

// Initialize xterm.js terminal
const { Terminal } = window;
const { FitAddon } = window.FitAddon;

// Global variables for current terminal instance
let terminal = null;
let fitAddon = null;

// Function to create a new terminal instance
function createNewTerminal() {
    // Dispose of existing terminal if it exists
    if (terminal) {
        terminal.dispose();
    }
    
    // Create new terminal instance
    terminal = new Terminal({
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
    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    
    return terminal;
}

// Function to initialize terminal
function initializeTerminal() {
    const terminalContainer = document.getElementById('terminal-container');
    terminalContainer.innerHTML = `
        <div class="flex flex-col h-full">
            <div id="terminal" class="flex-1"></div>
        </div>
    `;
    
    // Create a new terminal instance instead of reusing the old one
    createNewTerminal();
    
    // Mount new terminal to DOM element
    const newTerminalElement = document.getElementById('terminal');
    terminal.open(newTerminalElement);
    fitAddon.fit();
    
    // Set up terminal data handler for the new instance
    terminal.onData((data) => {
        if (window.WebSocketManager && window.WebSocketManager.isConnected()) {
            window.WebSocketManager.send({
                type: 'input',
                data: data
            });
        }
    });
    
    // Focus the new terminal instance
    terminal.focus();
    
    // Connect WebSocket
    if (window.WebSocketManager) {
        window.WebSocketManager.connect();
    }
    
    // Show navigation bar when terminal is active
    if (window.UI) {
        window.UI.showNavigationBar();
    }
}

// Handle terminal resize
function handleResize() {
    if (fitAddon) {
        fitAddon.fit();
    }
    if (window.WebSocketManager && window.WebSocketManager.isConnected() && terminal) {
        window.WebSocketManager.send({
            type: 'resize',
            cols: terminal.cols,
            rows: terminal.rows
        });
    }
}

// Get current terminal instance
function getTerminal() {
    return terminal;
}

// Get fit addon instance
function getFitAddon() {
    return fitAddon;
}

// Export terminal functions
window.Terminal = {
    createNewTerminal,
    initializeTerminal,
    handleResize,
    getTerminal,
    getFitAddon
};