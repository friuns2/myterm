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

// Function to initialize terminal in the DOM
function initializeTerminal() {
    // Show navigation bar when terminal is active
    showNavigationBar();
    
    // Create terminal container HTML
    const terminalContainer = document.getElementById('terminal-container');
    terminalContainer.innerHTML = `
        <div id="terminal" class="h-full"></div>
        
        <!-- Custom input container -->
        <div id="custom-input-container" class="bg-base-200 p-2 border-t border-base-300">
            <div class="flex gap-2">
                <input type="text" id="custom-command-input" placeholder="Type command and press Enter" class="input input-bordered input-sm flex-1">
                <div id="virtual-keyboard" class="flex gap-1">
                    <button class="btn btn-xs" data-key-code="27" title="Esc">Esc</button>
                    <button class="btn btn-xs" data-key-code="9" title="Tab">Tab</button>
                    <button class="btn btn-xs" data-key-code="3" title="Ctrl+C">^C</button>
                    <button class="btn btn-xs" data-key-code="17" title="Ctrl+...">Ctrl</button>
                    <button class="btn btn-xs" data-key-code="38" title="Up Arrow">↑</button>
                    <button class="btn btn-xs" data-key-code="40" title="Down Arrow">↓</button>
                    <button class="btn btn-xs" data-key-code="37" title="Left Arrow">←</button>
                    <button class="btn btn-xs" data-key-code="39" title="Right Arrow">→</button>
                </div>
            </div>
        </div>
    `;
    
    // Create new terminal instance
    createNewTerminal();
    
    // Open terminal in the container
    terminal.open(document.getElementById('terminal'));
    
    // Fit terminal to container
    fitAddon.fit();
    
    // Focus terminal
    terminal.focus();
    
    // Connect WebSocket
    connectWebSocket();
    
    // Set up terminal input handler
    terminal.onData((data) => {
        if (isConnected) {
            ws.send(JSON.stringify({
                type: 'input',
                data: data
            }));
        }
    });
}

// Handle terminal resize
const handleResize = () => {
    if (fitAddon) {
        fitAddon.fit();
    }
    if (isConnected && terminal) {
        ws.send(JSON.stringify({
            type: 'resize',
            cols: terminal.cols,
            rows: terminal.rows
        }));
    }
};

// Export functions for use in other modules
window.terminalModule = {
    createNewTerminal,
    initializeTerminal,
    handleResize,
    getTerminal: () => terminal,
    getFitAddon: () => fitAddon
};