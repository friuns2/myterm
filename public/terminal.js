// Terminal management module using xterm.js

import { debounce } from './utils.js';

// Terminal state
let terminal = null;
let fitAddon = null;

/**
 * Create a new terminal instance with proper configuration
 * @returns {Terminal} - New terminal instance
 */
export function createNewTerminal() {
    // Dispose of existing terminal if it exists
    if (terminal) {
        terminal.dispose();
    }
    
    // Create new terminal instance with improved configuration
    terminal = new window.Terminal({
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
        allowTransparency: false,
        scrollback: 10000, // Increased scrollback for better history
        tabStopWidth: 4
    });
    
    // Create new fit addon
    fitAddon = new window.FitAddon.FitAddon();
    terminal.loadAddon(fitAddon);
    
    return terminal;
}

/**
 * Get the current terminal instance
 * @returns {Terminal|null} - Current terminal instance
 */
export function getCurrentTerminal() {
    return terminal;
}

/**
 * Get the fit addon instance
 * @returns {FitAddon|null} - Current fit addon instance
 */
export function getFitAddon() {
    return fitAddon;
}

/**
 * Initialize terminal in the DOM
 * @param {string} containerId - ID of the container element
 * @param {Function} onDataCallback - Callback for terminal data
 */
export function initializeTerminalInDOM(containerId, onDataCallback) {
    const terminalContainer = document.getElementById(containerId);
    if (!terminalContainer) {
        console.error(`Terminal container not found: ${containerId}`);
        return;
    }
    
    terminalContainer.innerHTML = `
        <div class="flex flex-col h-full">
            <div id="terminal" class="flex-1"></div>
        </div>
    `;
    
    // Create a new terminal instance
    createNewTerminal();
    
    // Mount terminal to DOM element
    const terminalElement = document.getElementById('terminal');
    if (terminalElement) {
        terminal.open(terminalElement);
        fitAddon.fit();
        
        // Set up terminal data handler
        if (onDataCallback) {
            terminal.onData(onDataCallback);
        }
        
        // Focus the terminal
        terminal.focus();
        
        // Set up resize handler
        setupResizeHandler();
    }
}

/**
 * Write data to the terminal
 * @param {string} data - Data to write
 */
export function writeToTerminal(data) {
    if (terminal) {
        terminal.write(data);
    }
}

/**
 * Focus the terminal
 */
export function focusTerminal() {
    if (terminal) {
        terminal.focus();
    }
}

/**
 * Dispose of the current terminal
 */
export function disposeTerminal() {
    if (terminal) {
        terminal.dispose();
        terminal = null;
        fitAddon = null;
    }
}

/**
 * Refresh terminal display
 */
export function refreshTerminal() {
    if (terminal) {
        // Clear texture atlas to force redraw
        terminal.clearTextureAtlas();
        // Refresh the entire terminal display
        terminal.refresh(0, terminal.rows - 1);
    }
}

/**
 * Get terminal dimensions
 * @returns {Object} - Terminal dimensions {cols, rows}
 */
export function getTerminalDimensions() {
    if (terminal) {
        return {
            cols: terminal.cols,
            rows: terminal.rows
        };
    }
    return { cols: 80, rows: 24 }; // Default dimensions
}

/**
 * Fit terminal to container
 */
export function fitTerminal() {
    if (fitAddon) {
        fitAddon.fit();
    }
}

/**
 * Set up terminal resize handler
 */
function setupResizeHandler() {
    const debouncedResize = debounce(() => {
        fitTerminal();
    }, 100);
    
    window.addEventListener('resize', debouncedResize);
    
    // Handle visibility change (focus/blur)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && terminal) {
            terminal.focus();
        }
    });
}

/**
 * Setup terminal keyboard shortcuts
 */
export function setupTerminalShortcuts() {
    document.addEventListener('keydown', (event) => {
        // Only handle shortcuts when terminal is focused
        if (!terminal || !terminal.element?.contains(document.activeElement)) {
            return;
        }
        
        // Ctrl+Shift+C - Copy
        if (event.ctrlKey && event.shiftKey && event.key === 'C') {
            event.preventDefault();
            if (terminal.hasSelection()) {
                navigator.clipboard.writeText(terminal.getSelection());
            }
        }
        
        // Ctrl+Shift+V - Paste
        if (event.ctrlKey && event.shiftKey && event.key === 'V') {
            event.preventDefault();
            navigator.clipboard.readText().then(text => {
                terminal.paste(text);
            }).catch(err => {
                console.error('Failed to read clipboard:', err);
            });
        }
    });
}