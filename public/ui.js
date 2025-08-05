// UI management and event handlers

// File browser and editor functions
function showNavigationBar() {
    const navBar = document.getElementById('nav-bar');
    if (navBar) {
        navBar.classList.remove('hidden');
        
        // Update current path display
        const currentPathSpan = document.getElementById('current-path');
        if (currentPathSpan && currentProject) {
            currentPathSpan.textContent = `Project: ${currentProject}`;
        }
    }
}

function hideNavigationBar() {
    const navBar = document.getElementById('nav-bar');
    if (navBar) {
        navBar.classList.add('hidden');
    }
}

// Handle browser navigation (back/forward buttons)
window.addEventListener('popstate', (event) => {
    const newSessionID = getSessionIDFromURL();
    const newProject = getProjectFromURL();
    
    // Cleanup existing terminal if we're navigating away from a session
    if (sessionID && sessionID !== newSessionID && typeof cleanupTerminal === 'function') {
        cleanupTerminal();
    }
    
    sessionID = newSessionID;
    currentProject = newProject;
    
    if (sessionID) {
        initializeTerminal();
    } else if (currentProject) {
        showProjectSessions(currentProject);
    } else {
        showSessionsAndProjectsList();
    }
});

// Event listeners for file browser and editor
document.addEventListener('DOMContentLoaded', () => {
    // Navigation bar event listeners
    const backToSessionsBtn = document.getElementById('back-to-sessions');
    if (backToSessionsBtn) {
        backToSessionsBtn.addEventListener('click', () => {
            // Cleanup terminal before navigating away
            if (typeof cleanupTerminal === 'function') {
                cleanupTerminal();
            }
            
            if (currentProject) {
                goBackToProjectList();
            } else {
                goBackToSessionList();
            }
        });
    }
    
    const browseFilesBtn = document.getElementById('browse-files');
    if (browseFilesBtn) {
        browseFilesBtn.addEventListener('click', toggleFileBrowser);
    }
    
    // File browser event listeners
    const closeBrowserBtn = document.getElementById('close-browser');
    if (closeBrowserBtn) {
        closeBrowserBtn.addEventListener('click', closeFileBrowser);
    }
    
    const newFolderBtn = document.getElementById('new-folder');
    if (newFolderBtn) {
        newFolderBtn.addEventListener('click', createNewFolder);
    }
    
    const newFileBtn = document.getElementById('new-file');
    if (newFileBtn) {
        newFileBtn.addEventListener('click', createNewFile);
    }
    
    // Modal event listeners
    const createFileBtn = document.getElementById('create-file-btn');
    if (createFileBtn) {
        createFileBtn.addEventListener('click', handleFileCreation);
    }
    
    const cancelFileBtn = document.getElementById('cancel-file-btn');
    if (cancelFileBtn) {
        cancelFileBtn.addEventListener('click', () => {
            document.getElementById('new-file-modal').close();
        });
    }
    
    const createFolderBtn = document.getElementById('create-folder-btn');
    if (createFolderBtn) {
        createFolderBtn.addEventListener('click', handleFolderCreation);
    }
    
    const cancelFolderBtn = document.getElementById('cancel-folder-btn');
    if (cancelFolderBtn) {
        cancelFolderBtn.addEventListener('click', () => {
            document.getElementById('new-folder-modal').close();
        });
    }
    
    // Enter key handling for modal inputs
    const newFileNameInput = document.getElementById('new-file-name');
    if (newFileNameInput) {
        newFileNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleFileCreation();
            }
        });
    }
    
    const newFolderNameInput = document.getElementById('new-folder-name');
    if (newFolderNameInput) {
        newFolderNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleFolderCreation();
            }
        });
    }
    
    // File editor event listeners
    const saveFileBtn = document.getElementById('save-file');
    if (saveFileBtn) {
        saveFileBtn.addEventListener('click', saveCurrentFile);
    }
    
    const closeEditorBtn = document.getElementById('close-editor');
    if (closeEditorBtn) {
        closeEditorBtn.addEventListener('click', closeFileEditor);
    }
    
    // Keyboard shortcuts for editor
    const fileContentTextarea = document.getElementById('file-content');
    if (fileContentTextarea) {
        fileContentTextarea.addEventListener('keydown', (event) => {
            // Ctrl+S or Cmd+S to save
            if ((event.ctrlKey || event.metaKey) && event.key === 's') {
                event.preventDefault();
                saveCurrentFile();
            }
            
            // Tab key handling for proper indentation
            if (event.key === 'Tab') {
                event.preventDefault();
                const start = event.target.selectionStart;
                const end = event.target.selectionEnd;
                const value = event.target.value;
                
                // Insert tab character
                event.target.value = value.substring(0, start) + '\t' + value.substring(end);
                event.target.selectionStart = event.target.selectionEnd = start + 1;
            }
        });
    }
    
    // Global ESC key handler to close fullscreen panels
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            if (isFileEditorOpen) {
                closeFileEditor();
            } else if (isFileBrowserOpen) {
                closeFileBrowser();
            }
        }
    });
    
    // Click outside to close fullscreen panels
    document.addEventListener('click', (event) => {
        const fileBrowser = document.getElementById('file-browser');
        const fileEditor = document.getElementById('file-editor');
        
        if (isFileBrowserOpen && fileBrowser && !fileBrowser.contains(event.target) && !event.target.closest('#browse-files')) {
            closeFileBrowser();
        }
        
        if (isFileEditorOpen && fileEditor && !fileEditor.contains(event.target)) {
            // Don't close if clicking on file items to open them
            if (!event.target.closest('.file-item')) {
                closeFileEditor();
            }
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
    
    setupVirtualKeyboard();
    setupCustomCommandInput();
});

// Custom input field handling
function setupCustomCommandInput() {
    const customCommandInput = document.getElementById('custom-command-input');

    if (customCommandInput) {
        const sendCommand = () => {
            // Focus terminal first to ensure it's active
            if (terminal) {
                terminal.focus();
                // Add small delay to ensure focus is properly set
                setTimeout(() => {
                    const command = customCommandInput.value; // Add carriage return to simulate Enter
                    if (isConnected) {
                        ws.send(JSON.stringify({
                            type: 'input',
                            data: command
                        }));
                        setTimeout(() => {

                            ws.send(JSON.stringify({
                                type: 'input',
                                data: '\r'
                            }));
                        }, 50); // 50ms delay

                        customCommandInput.value = ''; // Clear input after sending
                    }
                }, 50); // 50ms delay
            } else {
                // If no terminal, send immediately
                const command = customCommandInput.value + '\r';
                if (isConnected) {
                    ws.send(JSON.stringify({
                        type: 'input',
                        data: command
                    }));
                    customCommandInput.value = '';
                }
            }
        };

        customCommandInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault(); // Prevent default Enter behavior
                sendCommand();
            }
        });
    }
}

// Virtual keyboard input
function setupVirtualKeyboard() {
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
                        // Prompt user for the next key
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
                            if (charCode >= 97 && charCode <= 122) { // 'a' through 'z'
                                data = String.fromCharCode(charCode - 96); // Convert to Ctrl+A to Ctrl+Z
                            } else if (nextKey === '[') {
                                data = '\x1B'; // Ctrl+[ is Esc
                            } else if (nextKey === '\\') {
                                data = '\x1C'; // Ctrl+\ is FS (File Separator)
                            } else if (nextKey === ']') {
                                data = '\x1D'; // Ctrl+] is GS (Group Separator)
                            } else if (nextKey === '^') {
                                data = '\x1E'; // Ctrl+^ is RS (Record Separator)
                            } else if (nextKey === '_') {
                                data = '\x1F'; // Ctrl+_ is US (Unit Separator)
                            }
                        }
                        break;
                    case 3: // Ctrl+C (ASCII End-of-Text character)
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
                        // For other keys, if we add them, we'd map them here.
                        break;
                }

                if (isConnected && data) {
                    // Focus terminal first to ensure it's active
                    if (terminal) {
                        terminal.focus();
                        // Add small delay to ensure focus is properly set
                        setTimeout(() => {
                            ws.send(JSON.stringify({
                                type: 'input',
                                data: data
                            }));
                        }, 50); // 50ms delay
                    } else {
                        // If no terminal, send immediately
                        ws.send(JSON.stringify({
                            type: 'input',
                            data: data
                        }));
                    }
                }
            }
        });
    }
} 