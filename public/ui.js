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
        // Command history management
        let commandHistory = JSON.parse(localStorage.getItem('terminalCommandHistory') || '[]');
        let historyIndex = -1;
        let currentInput = '';
        let suggestionsList = null;
        let aiPredictions = [];
        let isLoadingPredictions = false;
        
        // Function to fetch AI predictions
        const fetchAIPredictions = async (input) => {
            if (isLoadingPredictions || input.length < 2) return [];
            
            isLoadingPredictions = true;
            
            try {
                // Get operating system information
                const operatingSystem = navigator.platform || navigator.userAgentData?.platform || 'Unknown';
                
                // Get current command line screen content from terminal
                let commandLineScreen = '';
                if (window.terminal && window.terminal.buffer && window.terminal.buffer.active) {
                    const buffer = window.terminal.buffer.active;
                    const lines = [];
                    // Get last 10 lines of terminal output
                    const startLine = Math.max(0, buffer.length - 10);
                    for (let i = startLine; i < buffer.length; i++) {
                        const line = buffer.getLine(i);
                        if (line) {
                            lines.push(line.translateToString(true));
                        }
                    }
                    commandLineScreen = lines.join('\n').trim();
                }
                
                const response = await fetch('/api/predictions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        currentCommand: input,
                        context: commandHistory.slice(0, 5).join('\n'),
                        workingDirectory: window.currentWorkingDirectory || '/',
                        operatingSystem: operatingSystem,
                        commandLineScreen: commandLineScreen,
                        previousCommands: commandHistory.slice(-5) // Last 5 commands
                    })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    return data.suggestions || [];
                }
            } catch (error) {
                console.error('Failed to fetch AI predictions:', error);
            } finally {
                isLoadingPredictions = false;
            }
            
            return [];
        };
        
        // Show command suggestions (enhanced with AI predictions)
        const showSuggestions = async (input) => {
            if (!suggestionsList) {
                suggestionsList = createSuggestionsDropdown();
            }
            
            // Get history suggestions
            const historyFiltered = commandHistory.filter(cmd => 
                cmd.toLowerCase().includes(input.toLowerCase()) && cmd !== input
            ).slice(0, 3);
            
            // Show loading state if we need AI predictions
            suggestionsList.innerHTML = '';
            
            // Add history suggestions first
            historyFiltered.forEach((cmd, index) => {
                const item = document.createElement('div');
                item.className = 'px-3 py-2 cursor-pointer hover:bg-base-300 text-sm flex items-center';
                item.innerHTML = `<span class="text-blue-400 text-xs mr-2">HISTORY</span><span>${cmd}</span>`;
                item.addEventListener('click', () => {
                    customCommandInput.value = cmd;
                    suggestionsList.classList.add('hidden');
                    customCommandInput.focus();
                });
                suggestionsList.appendChild(item);
            });
            
            // Add AI predictions section
            const aiSection = document.createElement('div');
            aiSection.className = 'border-t border-base-300 mt-1 pt-1';
            
            if (isLoadingPredictions) {
                const loadingItem = document.createElement('div');
                loadingItem.className = 'px-3 py-2 text-sm text-gray-400';
                loadingItem.innerHTML = '<span class="text-green-400 text-xs mr-2">AI</span>Loading predictions...';
                aiSection.appendChild(loadingItem);
            } else {
                // Try to get AI predictions
                const predictions = await fetchAIPredictions(input);
                aiPredictions = predictions;
                
                predictions.slice(0, 3).forEach((cmd, index) => {
                    const item = document.createElement('div');
                    item.className = 'px-3 py-2 cursor-pointer hover:bg-base-300 text-sm flex items-center';
                    item.innerHTML = `<span class="text-green-400 text-xs mr-2">AI</span><span>${cmd}</span>`;
                    item.addEventListener('click', () => {
                        customCommandInput.value = cmd;
                        suggestionsList.classList.add('hidden');
                        customCommandInput.focus();
                    });
                    aiSection.appendChild(item);
                });
            }
            
            if (aiSection.children.length > 0) {
                suggestionsList.appendChild(aiSection);
            }
            
            // Show dropdown if we have any suggestions
            if (historyFiltered.length > 0 || aiPredictions.length > 0 || isLoadingPredictions) {
                suggestionsList.classList.remove('hidden');
            } else {
                suggestionsList.classList.add('hidden');
            }
        };
        
        // Hide suggestions
        const hideSuggestions = () => {
            if (suggestionsList) {
                suggestionsList.classList.add('hidden');
            }
        };

        const sendCommand = () => {
            const command = customCommandInput.value.trim();
            if (!command) return;
            
            // Save to history
            saveToHistory(command);
            historyIndex = -1;
            currentInput = '';
            hideSuggestions();
            
            // Focus terminal first to ensure it's active
            if (terminal) {
                terminal.focus();
                // Add small delay to ensure focus is properly set
                setTimeout(() => {
                    if (isConnected) {
                        // Send the multiline command
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

                        // Clear input and reset height
                        customCommandInput.value = '';
                        customCommandInput.style.height = 'auto';
                        customCommandInput.rows = 1;
                        
                        // Refocus the input field after sending command
                        setTimeout(() => {
                            customCommandInput.focus();
                        }, 100);
                    }
                }, 50); // 50ms delay
            } else {
                // If no terminal, send immediately
                if (isConnected) {
                    ws.send(JSON.stringify({
                        type: 'input',
                        data: command + '\r'
                    }));
                    // Clear input and reset height
                    customCommandInput.value = '';
                    customCommandInput.style.height = 'auto';
                    customCommandInput.rows = 1;
                    
                    // Refocus the input field after sending command
                    setTimeout(() => {
                        customCommandInput.focus();
                    }, 100);
                }
            }
        };

        customCommandInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                if (event.shiftKey) {
                    // Shift+Enter: Allow new line (default behavior)
                    // Auto-resize textarea
                    setTimeout(() => {
                        customCommandInput.style.height = 'auto';
                        customCommandInput.style.height = Math.min(customCommandInput.scrollHeight, 120) + 'px';
                    }, 0);
                } else {
                    // Enter: Send command
                    event.preventDefault();
                    sendCommand();
                }
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (historyIndex === -1) {
                    currentInput = customCommandInput.value;
                }
                if (historyIndex < commandHistory.length - 1) {
                    historyIndex++;
                    customCommandInput.value = commandHistory[historyIndex];
                    hideSuggestions();
                }
            } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (historyIndex > 0) {
                    historyIndex--;
                    customCommandInput.value = commandHistory[historyIndex];
                    hideSuggestions();
                } else if (historyIndex === 0) {
                    historyIndex = -1;
                    customCommandInput.value = currentInput;
                    hideSuggestions();
                }
            } else if (event.key === 'Escape') {
                hideSuggestions();
                historyIndex = -1;
                currentInput = '';
            }
        });
        
        // Auto-resize textarea on input and show suggestions
        customCommandInput.addEventListener('input', () => {
            customCommandInput.style.height = 'auto';
            customCommandInput.style.height = Math.min(customCommandInput.scrollHeight, 120) + 'px';
            
            // Reset history navigation when typing
            historyIndex = -1;
            currentInput = customCommandInput.value;
            
            // Show suggestions if input is not empty
            const input = customCommandInput.value.trim();
            if (input.length > 0) {
                showSuggestions(input);
            } else {
                hideSuggestions();
            }
        });
        
        // Reset height when cleared and hide suggestions
        customCommandInput.addEventListener('blur', () => {
            if (!customCommandInput.value.trim()) {
                customCommandInput.style.height = 'auto';
                customCommandInput.rows = 1;
            }
            // Hide suggestions after a short delay to allow clicking on them
            setTimeout(() => {
                hideSuggestions();
            }, 200);
        });
        
        // Show suggestions when focusing if there's input
        customCommandInput.addEventListener('focus', () => {
            const input = customCommandInput.value.trim();
            if (input.length > 0) {
                showSuggestions(input);
            }
        });
        
        // Initialize suggestions dropdown
        suggestionsList = createSuggestionsDropdown();
        
        // Hide suggestions when clicking outside
        document.addEventListener('click', (event) => {
            if (!customCommandInput.contains(event.target) && 
                (!suggestionsList || !suggestionsList.contains(event.target))) {
                hideSuggestions();
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

// Save command to history
const saveToHistory = (command) => {
    if (command && command.trim()) {
        let commandHistory = JSON.parse(localStorage.getItem('terminalCommandHistory') || '[]');
        const index = commandHistory.indexOf(command);
        if (index > -1) {
            commandHistory.splice(index, 1);
        }
        commandHistory.unshift(command);
        if (commandHistory.length > 100) {
            commandHistory = commandHistory.slice(0, 100);
        }
        localStorage.setItem('terminalCommandHistory', JSON.stringify(commandHistory));
    }
};

// Create suggestions dropdown
const createSuggestionsDropdown = () => {
    const customCommandInput = document.getElementById('custom-command-input');
    if (!customCommandInput) return null;
    
    const existingDropdown = customCommandInput.parentElement.querySelector('.absolute.bottom-full');
    if (existingDropdown) {
        existingDropdown.remove();
    }
    
    const suggestionsList = document.createElement('div');
    suggestionsList.className = 'absolute bottom-full left-0 right-0 bg-base-200 border border-base-300 rounded-t-lg max-h-40 overflow-y-auto z-50 hidden';
    suggestionsList.style.marginBottom = '2px';
    const container = customCommandInput.parentElement;
    container.style.position = 'relative';
    container.appendChild(suggestionsList);
    return suggestionsList;
};