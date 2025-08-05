// Event handlers module

function initializeEventHandlers() {
    // Terminal resize handler
    window.addEventListener('resize', () => {
        if (window.terminalModule && window.terminalModule.handleResize) {
            window.terminalModule.handleResize();
        }
    });
    
    // Visibility change handler for terminal focus
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && window.term) {
            setTimeout(() => {
                window.term.focus();
            }, 100);
        }
    });
    
    // Click to focus terminal
    document.addEventListener('click', (e) => {
        // Only focus terminal if clicking outside of specific UI elements
        if (!e.target.closest('.file-browser') && 
            !e.target.closest('.file-editor') && 
            !e.target.closest('.modal') && 
            !e.target.closest('button') && 
            !e.target.closest('input') && 
            !e.target.closest('textarea') && 
            window.term) {
            window.term.focus();
        }
    });
    
    // Browser navigation handler
    window.addEventListener('popstate', (event) => {
        const sessionId = window.urlUtils.getSessionIdFromURL();
        const projectName = window.urlUtils.getProjectFromURL();
        
        if (sessionId) {
            // Reconnect to session
            window.sessionID = sessionId;
            window.currentProject = null;
            window.terminalModule.initializeTerminal();
        } else if (projectName) {
            // Show project sessions
            window.projectManager.showProjectSessions(projectName);
        } else {
            // Show main sessions and projects list
            window.projectManager.showSessionsAndProjectsList();
        }
    });
    
    // Custom command input handler
    const customCommandInput = document.getElementById('custom-command-input');
    if (customCommandInput) {
        customCommandInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const command = customCommandInput.value.trim();
                if (command && window.webSocketModule && window.webSocketModule.sendData) {
                    window.webSocketModule.sendData(command + '\n');
                    customCommandInput.value = '';
                }
            }
        });
    }
    
    // Virtual keyboard handlers
    setupVirtualKeyboard();
    
    // File browser toggle handler
    const browseFilesBtn = document.getElementById('browse-files');
    if (browseFilesBtn) {
        browseFilesBtn.addEventListener('click', () => {
            window.fileBrowser.toggleFileBrowser();
        });
    }
    
    // Close file browser handler
    const closeBrowserBtn = document.getElementById('close-browser');
    if (closeBrowserBtn) {
        closeBrowserBtn.addEventListener('click', () => {
            window.fileBrowser.closeFileBrowser();
        });
    }
    
    // Close file editor handler
    const closeEditorBtn = document.getElementById('close-editor');
    if (closeEditorBtn) {
        closeEditorBtn.addEventListener('click', () => {
            window.fileEditor.closeFileEditor();
        });
    }
    
    // Save file handler
    const saveFileBtn = document.getElementById('save-file');
    if (saveFileBtn) {
        saveFileBtn.addEventListener('click', () => {
            window.fileEditor.saveCurrentFile();
        });
    }
    
    // New file and folder handlers
    const newFileBtn = document.getElementById('new-file');
    if (newFileBtn) {
        newFileBtn.addEventListener('click', () => {
            window.fileBrowser.createNewFile();
        });
    }
    
    const newFolderBtn = document.getElementById('new-folder');
    if (newFolderBtn) {
        newFolderBtn.addEventListener('click', () => {
            window.fileBrowser.createNewFolder();
        });
    }
    
    // Modal handlers for file/folder creation
    const createFileBtn = document.getElementById('create-file-btn');
    const cancelFileBtn = document.getElementById('cancel-file-btn');
    const createFolderBtn = document.getElementById('create-folder-btn');
    const cancelFolderBtn = document.getElementById('cancel-folder-btn');
    
    if (createFileBtn) {
        createFileBtn.addEventListener('click', () => {
            window.fileBrowser.handleFileCreation();
        });
    }
    
    if (cancelFileBtn) {
        cancelFileBtn.addEventListener('click', () => {
            document.getElementById('new-file-modal').close();
        });
    }
    
    if (createFolderBtn) {
        createFolderBtn.addEventListener('click', () => {
            window.fileBrowser.handleFolderCreation();
        });
    }
    
    if (cancelFolderBtn) {
        cancelFolderBtn.addEventListener('click', () => {
            document.getElementById('new-folder-modal').close();
        });
    }
    
    // Enter key handlers for modal inputs
    const newFileNameInput = document.getElementById('new-file-name');
    const newFolderNameInput = document.getElementById('new-folder-name');
    
    if (newFileNameInput) {
        newFileNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                window.fileBrowser.handleFileCreation();
            }
        });
    }
    
    if (newFolderNameInput) {
        newFolderNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                window.fileBrowser.handleFolderCreation();
            }
        });
    }
    
    // File editor save shortcut (Ctrl+S or Cmd+S)
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            if (window.fileEditor && window.fileEditor.isOpen()) {
                e.preventDefault();
                window.fileEditor.saveCurrentFile();
            }
        }
    });
}

function setupVirtualKeyboard() {
    const virtualKeyboard = document.getElementById('virtual-keyboard');
    if (!virtualKeyboard) return;
    
    // Common terminal commands/keys
    const commands = [
        { text: 'ls', command: 'ls\n' },
        { text: 'cd', command: 'cd ' },
        { text: 'pwd', command: 'pwd\n' },
        { text: 'clear', command: 'clear\n' },
        { text: 'exit', command: 'exit\n' },
        { text: 'Tab', command: '\t' },
        { text: 'Ctrl+C', command: '\x03' },
        { text: 'Ctrl+D', command: '\x04' },
        { text: 'Up', command: '\x1b[A' },
        { text: 'Down', command: '\x1b[B' },
        { text: 'Enter', command: '\n' }
    ];
    
    // Clear existing buttons
    virtualKeyboard.innerHTML = '';
    
    // Create buttons for each command
    commands.forEach(cmd => {
        const button = document.createElement('button');
        button.textContent = cmd.text;
        button.className = 'btn btn-sm btn-outline mr-1 mb-1';
        button.addEventListener('click', () => {
            if (window.webSocketModule && window.webSocketModule.sendData) {
                window.webSocketModule.sendData(cmd.command);
            }
            // Focus back to terminal
            if (window.term) {
                window.term.focus();
            }
        });
        virtualKeyboard.appendChild(button);
    });
}

// Initialize event handlers when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeEventHandlers);
} else {
    initializeEventHandlers();
}

// Export functions for use in other modules
window.eventHandlers = {
    initializeEventHandlers,
    setupVirtualKeyboard
};

// Make functions globally available
window.initializeEventHandlers = initializeEventHandlers;
window.setupVirtualKeyboard = setupVirtualKeyboard;