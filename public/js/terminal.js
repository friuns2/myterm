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

// Function to strip ANSI escape sequences from text
function stripAnsiCodes(text) {
    // Remove ANSI escape sequences
    return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

// Function to convert ANSI escape sequences to HTML
function ansiToHtml(text) {
    const ansiMap = {
        '\x1b[0m': '</span>',  // Reset
        '\x1b[1m': '<span style="font-weight: bold;">',  // Bold
        '\x1b[4m': '<span style="text-decoration: underline;">',  // Underline
        '\x1b[30m': '<span style="color: black;">',  // Black
        '\x1b[31m': '<span style="color: red;">',    // Red
        '\x1b[32m': '<span style="color: green;">',  // Green
        '\x1b[33m': '<span style="color: yellow;">',  // Yellow
        '\x1b[34m': '<span style="color: blue;">',   // Blue
        '\x1b[35m': '<span style="color: magenta;">',  // Magenta
        '\x1b[36m': '<span style="color: cyan;">',   // Cyan
        '\x1b[37m': '<span style="color: white;">',  // White
        '\x1b[90m': '<span style="color: gray;">',   // Bright Black (Gray)
        '\x1b[91m': '<span style="color: lightcoral;">',  // Bright Red
        '\x1b[92m': '<span style="color: lightgreen;">',  // Bright Green
        '\x1b[93m': '<span style="color: lightyellow;">',  // Bright Yellow
        '\x1b[94m': '<span style="color: lightblue;">',   // Bright Blue
        '\x1b[95m': '<span style="color: lightpink;">',   // Bright Magenta
        '\x1b[96m': '<span style="color: lightcyan;">',   // Bright Cyan
        '\x1b[97m': '<span style="color: white;">',       // Bright White
    };
    
    return Object.keys(ansiMap).reduce((result, ansiCode) => {
        const regex = new RegExp(ansiCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        return result.replace(regex, ansiMap[ansiCode]);
    }, text).replace(/\n/g, '<br>');
}

function initializeTerminal() {
    const terminalContainer = document.getElementById('terminal');
    if (!terminalContainer) {
        console.error('Terminal container not found');
        return;
    }

    // Clear any existing content
    terminalContainer.innerHTML = '';

    // Create new terminal
    createNewTerminal();
    
    // Open terminal in container
    terminal.open(terminalContainer);
    
    // Fit terminal to container
    setTimeout(() => {
        fitAddon.fit();
    }, 100);

    // Connect WebSocket
    connectWebSocket();
    
    // Show navigation bar
    showNavigationBar();
}

// Resize handler
const handleResize = () => {
    if (fitAddon && terminal) {
        try {
            fitAddon.fit();
        } catch (error) {
            console.error('Error fitting terminal:', error);
        }
    }
};

// Export functions for use in other modules
window.TerminalModule = {
    createNewTerminal,
    stripAnsiCodes,
    ansiToHtml,
    initializeTerminal,
    handleResize,
    getTerminal: () => terminal,
    getFitAddon: () => fitAddon
};