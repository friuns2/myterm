// Terminal Command Aliases Management

// Global aliases storage
let aliases = {};
let currentEditingAlias = null;

// Load aliases from localStorage
function loadAliases() {
    try {
        const stored = localStorage.getItem('terminal_aliases');
        if (stored) {
            aliases = JSON.parse(stored);
        } else {
            // Set up default aliases for new users
            aliases = {
                'll': {
                    command: 'ls -la',
                    description: 'List files in long format with hidden files',
                    created: new Date().toISOString(),
                    modified: new Date().toISOString()
                },
                'la': {
                    command: 'ls -la',
                    description: 'List all files including hidden ones',
                    created: new Date().toISOString(),
                    modified: new Date().toISOString()
                },
                'gs': {
                    command: 'git status',
                    description: 'Show git repository status',
                    created: new Date().toISOString(),
                    modified: new Date().toISOString()
                },
                'gp': {
                    command: 'git push',
                    description: 'Push changes to remote repository',
                    created: new Date().toISOString(),
                    modified: new Date().toISOString()
                },
                'gl': {
                    command: 'git log --oneline -10',
                    description: 'Show last 10 git commits in one line',
                    created: new Date().toISOString(),
                    modified: new Date().toISOString()
                },
                'aliases': {
                    command: 'echo "Available aliases: ll, la, gs, gp, gl, aliases"',
                    description: 'Show all available aliases',
                    created: new Date().toISOString(),
                    modified: new Date().toISOString()
                }
            };
            saveAliases();
        }
    } catch (error) {
        console.error('Error loading aliases:', error);
        aliases = {};
    }
}

// Save aliases to localStorage
function saveAliases() {
    try {
        localStorage.setItem('terminal_aliases', JSON.stringify(aliases));
    } catch (error) {
        console.error('Error saving aliases:', error);
    }
}

// Initialize aliases system
function initializeAliases() {
    loadAliases();
    setupAliasesEventListeners();
    renderAliasesList();
}

// Setup event listeners for aliases functionality
function setupAliasesEventListeners() {
    // Aliases panel toggle
    const aliasesButton = document.getElementById('aliases-editor');
    const aliasesPanel = document.getElementById('aliases-panel');
    const closeAliasesButton = document.getElementById('close-aliases');
    
    if (aliasesButton) {
        aliasesButton.addEventListener('click', () => {
            toggleAliasesPanel();
        });
    }
    
    if (closeAliasesButton) {
        closeAliasesButton.addEventListener('click', () => {
            hideAliasesPanel();
        });
    }
    
    // Add alias button
    const addAliasButton = document.getElementById('add-alias');
    if (addAliasButton) {
        addAliasButton.addEventListener('click', () => {
            openAliasModal();
        });
    }
    
    // Modal event listeners
    const saveAliasButton = document.getElementById('save-alias-btn');
    const cancelAliasButton = document.getElementById('cancel-alias-btn');
    
    if (saveAliasButton) {
        saveAliasButton.addEventListener('click', () => {
            saveAlias();
        });
    }
    
    if (cancelAliasButton) {
        cancelAliasButton.addEventListener('click', () => {
            closeAliasModal();
        });
    }
    
    // Enter key handling in alias name field
    const aliasNameInput = document.getElementById('alias-name');
    if (aliasNameInput) {
        aliasNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('alias-command').focus();
            }
        });
    }
    
    // Enter key handling in alias command field
    const aliasCommandInput = document.getElementById('alias-command');
    if (aliasCommandInput) {
        aliasCommandInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                saveAlias();
            }
        });
    }
}

// Toggle aliases panel visibility
function toggleAliasesPanel() {
    const aliasesPanel = document.getElementById('aliases-panel');
    const fileBrowser = document.getElementById('file-browser');
    const fileEditor = document.getElementById('file-editor');
    
    if (aliasesPanel.classList.contains('hidden')) {
        // Hide other panels
        fileBrowser.classList.add('hidden');
        fileEditor.classList.add('hidden');
        
        // Show aliases panel
        aliasesPanel.classList.remove('hidden');
        aliasesPanel.classList.add('flex');
        
        renderAliasesList();
    } else {
        hideAliasesPanel();
    }
}

// Hide aliases panel
function hideAliasesPanel() {
    const aliasesPanel = document.getElementById('aliases-panel');
    aliasesPanel.classList.add('hidden');
    aliasesPanel.classList.remove('flex');
}

// Open alias creation/editing modal
function openAliasModal(aliasName = null) {
    const modal = document.getElementById('alias-modal');
    const modalTitle = document.getElementById('alias-modal-title');
    const nameInput = document.getElementById('alias-name');
    const commandInput = document.getElementById('alias-command');
    const descriptionInput = document.getElementById('alias-description');
    
    currentEditingAlias = aliasName;
    
    if (aliasName && aliases[aliasName]) {
        // Editing existing alias
        modalTitle.textContent = 'Edit Alias';
        nameInput.value = aliasName;
        commandInput.value = aliases[aliasName].command;
        descriptionInput.value = aliases[aliasName].description || '';
        nameInput.disabled = true; // Don't allow changing alias name when editing
    } else {
        // Creating new alias
        modalTitle.textContent = 'Create New Alias';
        nameInput.value = '';
        commandInput.value = '';
        descriptionInput.value = '';
        nameInput.disabled = false;
    }
    
    modal.showModal();
    nameInput.focus();
}

// Close alias modal
function closeAliasModal() {
    const modal = document.getElementById('alias-modal');
    modal.close();
    currentEditingAlias = null;
}

// Save alias
function saveAlias() {
    const nameInput = document.getElementById('alias-name');
    const commandInput = document.getElementById('alias-command');
    const descriptionInput = document.getElementById('alias-description');
    
    const name = nameInput.value.trim();
    const command = commandInput.value.trim();
    const description = descriptionInput.value.trim();
    
    // Validation
    if (!name) {
        showError('Alias name is required');
        nameInput.focus();
        return;
    }
    
    if (!command) {
        showError('Command is required');
        commandInput.focus();
        return;
    }
    
    // Check for invalid characters in alias name
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        showError('Alias name can only contain letters, numbers, underscores, and hyphens');
        nameInput.focus();
        return;
    }
    
    // Check if alias already exists (when creating new)
    if (!currentEditingAlias && aliases[name]) {
        showError('An alias with this name already exists');
        nameInput.focus();
        return;
    }
    
    // Save the alias
    aliases[name] = {
        command: command,
        description: description,
        created: currentEditingAlias ? aliases[name].created : new Date().toISOString(),
        modified: new Date().toISOString()
    };
    
    saveAliases();
    renderAliasesList();
    closeAliasModal();
    
    showSuccess(`Alias "${name}" ${currentEditingAlias ? 'updated' : 'created'} successfully`);
}

// Delete alias
function deleteAlias(aliasName) {
    if (confirm(`Are you sure you want to delete the alias "${aliasName}"?`)) {
        delete aliases[aliasName];
        saveAliases();
        renderAliasesList();
        showSuccess(`Alias "${aliasName}" deleted successfully`);
    }
}

// Render aliases list
function renderAliasesList() {
    const aliasesList = document.getElementById('aliases-list');
    const noAliases = document.getElementById('no-aliases');
    
    if (!aliasesList) return;
    
    aliasesList.innerHTML = '';
    
    const aliasNames = Object.keys(aliases).sort();
    
    if (aliasNames.length === 0) {
        noAliases.classList.remove('hidden');
        return;
    }
    
    noAliases.classList.add('hidden');
    
    aliasNames.forEach(name => {
        const alias = aliases[name];
        const aliasElement = document.createElement('div');
        aliasElement.className = 'bg-base-200 rounded-lg p-3 border border-base-300';
        
        aliasElement.innerHTML = `
            <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                        <span class="font-mono font-semibold text-primary">${escapeHtml(name)}</span>
                        <button class="btn btn-xs btn-ghost" onclick="executeAlias('${escapeHtml(name)}')">▶ Run</button>
                    </div>
                    <div class="text-sm font-mono bg-base-300 rounded px-2 py-1 mb-2 break-all">
                        ${escapeHtml(alias.command)}
                    </div>
                    ${alias.description ? `<div class="text-xs opacity-70">${escapeHtml(alias.description)}</div>` : ''}
                </div>
                <div class="flex gap-1 ml-2">
                    <button class="btn btn-xs btn-outline" onclick="openAliasModal('${escapeHtml(name)}')">Edit</button>
                    <button class="btn btn-xs btn-error btn-outline" onclick="deleteAlias('${escapeHtml(name)}')">Delete</button>
                </div>
            </div>
        `;
        
        aliasesList.appendChild(aliasElement);
    });
}

// Execute alias command
function executeAlias(aliasName) {
    if (!aliases[aliasName]) {
        showError(`Alias "${aliasName}" not found`);
        return;
    }
    
    const command = aliases[aliasName].command;
    
    // Send command to terminal
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'input',
            data: command + '\r'
        }));
        
        // Hide aliases panel after executing command
        hideAliasesPanel();
        
        // Focus terminal
        if (terminal) {
            terminal.focus();
        }
    } else {
        showError('Terminal not connected');
    }
}

// Track current command being typed
let currentCommand = '';

// Intercept terminal input to check for aliases
function interceptTerminalInput(data) {
    // Handle different input types
    if (data === '\r') {
        // Enter key pressed - check if current command is an alias
        const commandParts = currentCommand.trim().split(/\s+/);
        const firstWord = commandParts[0];
        
        if (firstWord && aliases[firstWord]) {
            // Replace the alias with the actual command
            const aliasCommand = aliases[firstWord].command;
            const restOfCommand = commandParts.slice(1).join(' ');
            const fullCommand = aliasCommand + (restOfCommand ? ' ' + restOfCommand : '');
            
            // Clear current command tracking
            currentCommand = '';
            
            // Send the expanded command
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'input',
                    data: fullCommand + '\r'
                }));
            }
            
            return true; // Indicate that we handled the input
        }
        
        // Reset command tracking for next command
        currentCommand = '';
    } else if (data === '\x7f') {
        // Backspace - remove last character
        currentCommand = currentCommand.slice(0, -1);
    } else if (data === '\x03') {
        // Ctrl+C - reset command
        currentCommand = '';
    } else if (data.length === 1 && data.charCodeAt(0) >= 32 && data.charCodeAt(0) <= 126) {
        // Printable character - add to current command
        currentCommand += data;
    } else if (data === '\x1b[A' || data === '\x1b[B') {
        // Arrow up/down - reset command tracking (history navigation)
        currentCommand = '';
    }
    
    return false; // Let the normal input handling proceed
}

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showError(message) {
    if (window.Swal) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: message,
            timer: 3000,
            showConfirmButton: false
        });
    } else {
        alert('Error: ' + message);
    }
}

function showSuccess(message) {
    if (window.Swal) {
        Swal.fire({
            icon: 'success',
            title: 'Success',
            text: message,
            timer: 2000,
            showConfirmButton: false
        });
    } else {
        alert(message);
    }
}

// Export functions for global access
window.openAliasModal = openAliasModal;
window.deleteAlias = deleteAlias;
window.executeAlias = executeAlias;
window.interceptTerminalInput = interceptTerminalInput;

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAliases);
} else {
    initializeAliases();
}