// Main initialization and coordination module

import { getURLParameter } from './utils.js';
import { 
    initializeTerminalInDOM, 
    setupTerminalShortcuts, 
    focusTerminal, 
    getCurrentTerminal 
} from './terminal.js';
import { 
    connectWebSocket, 
    sendTerminalInput, 
    sendTerminalResize,
    setWebSocketCallbacks,
    getSessionID,
    getCurrentProject,
    isWebSocketConnected
} from './websocket.js';
import { 
    setupNavigationListeners, 
    setupBrowserNavigation, 
    initializeNavigation,
    showNavigationBar,
    hideNavigationBar
} from './navigation.js';
import { setupFileEditorShortcuts } from './fileEditor.js';
import * as sessionsModule from './sessions.js';
import * as projectsModule from './projects.js';
import * as fileBrowserModule from './fileBrowser.js';
import * as fileEditorModule from './fileEditor.js';
import * as worktreesModule from './worktrees.js';
import * as navigationModule from './navigation.js';

/**
 * Initialize terminal with WebSocket connection
 */
export function initializeTerminal() {
    initializeTerminalInDOM('terminal-container', (data) => {
        // Terminal data handler
        sendTerminalInput(data);
    });
    
    // Connect WebSocket
    connectWebSocket();
    
    // Show navigation bar when terminal is active
    showNavigationBar();
}

/**
 * Setup all event listeners for the application
 */
function setupEventListeners() {
    // Navigation listeners
    setupNavigationListeners();
    
    // File browser event listeners
    setupFileBrowserListeners();
    
    // File editor event listeners
    setupFileEditorListeners();
    
    // Modal event listeners
    setupModalListeners();
    
    // Custom input and virtual keyboard
    setupCustomInputListeners();
    
    // Global keyboard shortcuts
    setupGlobalKeyboardShortcuts();
    
    // Click handlers for focus management
    setupClickHandlers();
    
    // Terminal resize handlers
    setupResizeHandlers();
}

/**
 * Setup file browser event listeners
 */
function setupFileBrowserListeners() {
    const closeBrowserBtn = document.getElementById('close-browser');
    if (closeBrowserBtn) {
        closeBrowserBtn.addEventListener('click', fileBrowserModule.closeFileBrowser);
    }
    
    const newFolderBtn = document.getElementById('new-folder');
    if (newFolderBtn) {
        newFolderBtn.addEventListener('click', fileBrowserModule.createNewFolder);
    }
    
    const newFileBtn = document.getElementById('new-file');
    if (newFileBtn) {
        newFileBtn.addEventListener('click', fileBrowserModule.createNewFile);
    }
}

/**
 * Setup file editor event listeners
 */
function setupFileEditorListeners() {
    const saveFileBtn = document.getElementById('save-file');
    if (saveFileBtn) {
        saveFileBtn.addEventListener('click', fileEditorModule.saveCurrentFile);
    }
    
    const closeEditorBtn = document.getElementById('close-editor');
    if (closeEditorBtn) {
        closeEditorBtn.addEventListener('click', fileEditorModule.closeFileEditor);
    }
}

/**
 * Setup modal event listeners
 */
function setupModalListeners() {
    // File creation modal
    const createFileBtn = document.getElementById('create-file-btn');
    if (createFileBtn) {
        createFileBtn.addEventListener('click', fileBrowserModule.handleFileCreation);
    }
    
    const cancelFileBtn = document.getElementById('cancel-file-btn');
    if (cancelFileBtn) {
        cancelFileBtn.addEventListener('click', () => {
            const modal = document.getElementById('new-file-modal');
            if (modal) modal.close();
        });
    }
    
    // Folder creation modal
    const createFolderBtn = document.getElementById('create-folder-btn');
    if (createFolderBtn) {
        createFolderBtn.addEventListener('click', fileBrowserModule.handleFolderCreation);
    }
    
    const cancelFolderBtn = document.getElementById('cancel-folder-btn');
    if (cancelFolderBtn) {
        cancelFolderBtn.addEventListener('click', () => {
            const modal = document.getElementById('new-folder-modal');
            if (modal) modal.close();
        });
    }
    
    // Enter key handling for modal inputs
    const newFileNameInput = document.getElementById('new-file-name');
    if (newFileNameInput) {
        newFileNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                fileBrowserModule.handleFileCreation();
            }
        });
    }
    
    const newFolderNameInput = document.getElementById('new-folder-name');
    if (newFolderNameInput) {
        newFolderNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                fileBrowserModule.handleFolderCreation();
            }
        });
    }
}

/**
 * Setup custom input and virtual keyboard listeners
 */
function setupCustomInputListeners() {
    const customCommandInput = document.getElementById('custom-command-input');
    if (customCommandInput) {
        const sendCommand = () => {
            const terminal = getCurrentTerminal();
            if (terminal) {
                terminal.focus();
                setTimeout(() => {
                    const command = customCommandInput.value;
                    if (isWebSocketConnected()) {
                        sendTerminalInput(command);
                        setTimeout(() => {
                            sendTerminalInput('\r');
                        }, 50);
                        customCommandInput.value = '';
                    }
                }, 50);
            } else {
                const command = customCommandInput.value + '\r';
                if (isWebSocketConnected()) {
                    sendTerminalInput(command);
                    customCommandInput.value = '';
                }
            }
        };

        customCommandInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                sendCommand();
            }
        });
    }
    
    // Virtual keyboard
    const virtualKeyboard = document.getElementById('virtual-keyboard');
    if (virtualKeyboard) {
        virtualKeyboard.addEventListener('click', async (event) => {
            const button = event.target.closest('button[data-key-code]');
            if (button) {
                const keyCode = parseInt(button.dataset.keyCode, 10);
                let data = '';

                switch (keyCode) {
                    case 27: // Esc
                        data = '\x1B';
                        break;
                    case 9: // Tab
                        data = '\x09';
                        break;
                    case 17: // Ctrl
                        const { value: nextKey } = await Swal.fire({
                            title: 'Ctrl Key Combination',
                            input: 'text',
                            inputLabel: 'Enter next key for Ctrl combination',
                            inputPlaceholder: "e.g., 'c' for Ctrl+C, 'z' for Ctrl+Z",
                            showCancelButton: true,
                            inputValidator: (value) => {
                                if (!value) {
                                    return 'You need to enter a key!';
                                }
                            }
                        });
                        if (nextKey) {
                            const charCode = nextKey.toLowerCase().charCodeAt(0);
                            if (charCode >= 97 && charCode <= 122) {
                                data = String.fromCharCode(charCode - 96);
                            } else if (nextKey === '[') {
                                data = '\x1B';
                            } else if (nextKey === '\\') {
                                data = '\x1C';
                            } else if (nextKey === ']') {
                                data = '\x1D';
                            } else if (nextKey === '^') {
                                data = '\x1E';
                            } else if (nextKey === '_') {
                                data = '\x1F';
                            }
                        }
                        break;
                    case 3: // Ctrl+C
                        data = '\x03';
                        break;
                    case 38: // Up Arrow
                        data = '\x1B[A';
                        break;
                    case 40: // Down Arrow
                        data = '\x1B[B';
                        break;
                    case 37: // Left Arrow
                        data = '\x1B[D';
                        break;
                    case 39: // Right Arrow
                        data = '\x1B[C';
                        break;
                    default:
                        break;
                }

                if (isWebSocketConnected() && data) {
                    const terminal = getCurrentTerminal();
                    if (terminal) {
                        terminal.focus();
                        setTimeout(() => {
                            sendTerminalInput(data);
                        }, 50);
                    } else {
                        sendTerminalInput(data);
                    }
                }
            }
        });
    }
}

/**
 * Setup global keyboard shortcuts
 */
function setupGlobalKeyboardShortcuts() {
    setupTerminalShortcuts();
    setupFileEditorShortcuts();
    
    // Global ESC key handler to close fullscreen panels
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            if (fileEditorModule.getFileEditorOpenStatus()) {
                fileEditorModule.closeFileEditor();
            } else if (fileBrowserModule.getFileBrowserOpenStatus()) {
                fileBrowserModule.closeFileBrowser();
            }
        }
    });
}

/**
 * Setup click handlers for focus management
 */
function setupClickHandlers() {
    // Focus terminal when clicking anywhere (but not on custom inputs)
    document.addEventListener('click', (event) => {
        const customInputContainer = document.getElementById('virtual-keyboard');
        const fileBrowser = document.getElementById('file-browser');
        const fileEditor = document.getElementById('file-editor');
        
        // Don't focus terminal if clicking on special areas
        if (customInputContainer?.contains(event.target) ||
            fileBrowser?.contains(event.target) ||
            fileEditor?.contains(event.target)) {
            return;
        }
        
        const terminal = getCurrentTerminal();
        if (terminal) {
            terminal.focus();
        }
    });
    
    // Click outside to close fullscreen panels
    document.addEventListener('click', (event) => {
        const fileBrowser = document.getElementById('file-browser');
        const fileEditor = document.getElementById('file-editor');
        
        if (fileBrowserModule.getFileBrowserOpenStatus() && 
            fileBrowser && 
            !fileBrowser.contains(event.target) && 
            !event.target.closest('#browse-files')) {
            fileBrowserModule.closeFileBrowser();
        }
        
        if (fileEditorModule.getFileEditorOpenStatus() && 
            fileEditor && 
            !fileEditor.contains(event.target) &&
            !event.target.closest('.file-item')) {
            fileEditorModule.closeFileEditor();
        }
    });
    
    // Prevent clicks inside panels from bubbling up
    const fileBrowser = document.getElementById('file-browser');
    const fileEditor = document.getElementById('file-editor');
    
    if (fileBrowser) {
        fileBrowser.addEventListener('click', (event) => {
            event.stopPropagation();
        });
    }
    
    if (fileEditor) {
        fileEditor.addEventListener('click', (event) => {
            event.stopPropagation();
        });
    }
}

/**
 * Setup resize handlers
 */
function setupResizeHandlers() {
    window.addEventListener('resize', () => {
        sendTerminalResize();
    });
}

/**
 * Setup WebSocket callbacks
 */
function setupWebSocketCallbacks() {
    setWebSocketCallbacks({
        onSessionIDReceived: (sessionId) => {
            console.log('Session ID received:', sessionId);
        },
        onConnectionStatusChanged: (isConnected) => {
            console.log('Connection status changed:', isConnected);
        }
    });
}

/**
 * Initialize the application
 */
function initialize() {
    console.log('Initializing web terminal application...');
    
    // Setup WebSocket callbacks
    setupWebSocketCallbacks();
    
    // Setup browser navigation
    setupBrowserNavigation();
    
    // Setup all event listeners
    setupEventListeners();
    
    // Make modules available globally for HTML onclick handlers
    window.sessionsModule = sessionsModule;
    window.projectsModule = projectsModule;
    window.fileBrowserModule = fileBrowserModule;
    window.fileEditorModule = fileEditorModule;
    window.worktreesModule = worktreesModule;
    window.navigationModule = navigationModule;
    
    // Initialize navigation based on URL
    initializeNavigation();
    
    console.log('Application initialized successfully');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
} else {
    initialize();
} 