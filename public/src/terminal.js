import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

// Global variables for current terminal instance
let terminal = null;
let fitAddon = null;

// Function to create a new terminal instance
export function createNewTerminal() {
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

export function getTerminalInstance() {
    return terminal;
}

export function getFitAddonInstance() {
    return fitAddon;
}

// Handle terminal resize
export const handleResize = () => {
    if (fitAddon) {
        fitAddon.fit();
    }
    // WebSocket send logic will be handled in websocket.js
}; 