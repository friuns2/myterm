// Aliases management functionality

let aliasAutoSaveTimeout = null;
let aliasHasUnsavedChanges = false;

// Function to show aliases management interface
async function showAliasesManager() {
    // Add to navigation history
    navigationHistory.pushState({
        type: 'aliases',
        title: 'Shell Aliases',
        data: {}
    });
    
    try {
        const response = await fetch('/api/aliases');
        const data = await response.json();
        
        const terminalContainer = document.getElementById('terminal-container');
        terminalContainer.innerHTML = `
            <div class="p-6 max-w-4xl mx-auto h-full flex flex-col">
                <div class="flex items-center justify-between mb-6">
                    <h1 class="text-3xl font-bold">Shell Aliases Manager</h1>
                    <div class="flex gap-2">
                        <span id="alias-save-status" class="text-sm opacity-70"></span>
                        <button id="back-to-dashboard" class="btn btn-outline" onclick="navigationHistory.pushState({type: 'sessions', title: 'Sessions & Projects', data: {}})">← Back to Dashboard</button>
                    </div>
                </div>
                
                <div class="bg-base-200 rounded-lg p-4 mb-6">
                    <p class="text-sm opacity-70 mb-2">
                        Create and manage zsh shell aliases. Aliases are stored in your ~/.zshrc file.
                        Use the format: <code>alias name='command'</code> or just <code>name=command</code> (auto-formatted).
                        Changes are automatically saved and will be available in new terminal sessions.
                    </p>
                    <p class="text-xs opacity-50 mb-2">
                        Examples:<br>
                        • <code>alias ll='ls -la'</code><br>
                        • <code>alias gs='git status'</code><br>
                        • <code>alias ..='cd ..'</code>
                    </p>
                    <div class="text-xs opacity-50">
                        <strong>Location:</strong> ${data.zshrcPath || '~/.zshrc'}
                        ${data.hasZshrc ? '<span class="text-success">✓ Found</span>' : '<span class="text-warning">⚠ Will be created</span>'}
                    </div>
                </div>
                
                <!-- Text Editor Section -->
                <div class="bg-base-100 rounded-lg border border-base-300 flex-1 flex flex-col">
                    <div class="flex items-center justify-between p-4 border-b border-base-300">
                        <h2 class="text-xl font-semibold">Shell Aliases</h2>
                        <div class="flex gap-2">
                            <button id="clear-all-aliases" class="btn btn-error btn-sm">Clear All</button>
                            <button id="save-aliases-manually" class="btn btn-primary btn-sm">Save Now</button>
                        </div>
                    </div>
                    
                    <div class="flex-1 p-4">
                        <textarea 
                            id="aliases-editor" 
                            class="textarea textarea-bordered w-full h-full resize-none font-mono text-sm" 
                            placeholder="# Add your shell aliases here\n# Format: alias name='command' or just name=command\n# Examples:\nalias ll='ls -la'\nalias gs='git status'\nalias ..='cd ..'\nalias grep='grep --color=auto'\nalias h='history'\nalias c='clear'"
                            spellcheck="false"
                        >${data.text || ''}</textarea>
                    </div>
                </div>
            </div>
        `;
        
        setupAliasesEventListeners();
        updateAliasSaveStatus('Loaded');
        
    } catch (error) {
        console.error('Error loading aliases:', error);
        alert('Failed to load aliases');
    }
}

// Setup event listeners for aliases management
function setupAliasesEventListeners() {
    const backButton = document.getElementById('back-to-dashboard');
    const aliasesEditor = document.getElementById('aliases-editor');
    const clearAllButton = document.getElementById('clear-all-aliases');
    const saveButton = document.getElementById('save-aliases-manually');
    
    // Back to dashboard with auto-save
    backButton.addEventListener('click', async () => {
        if (aliasHasUnsavedChanges) {
            await saveAliases();
        }
        showSessionsAndProjectsList();
    });
    
    // Auto-save on text change
    aliasesEditor.addEventListener('input', () => {
        aliasHasUnsavedChanges = true;
        updateAliasSaveStatus('Unsaved changes...');
        
        // Clear existing timeout
        if (aliasAutoSaveTimeout) {
            clearTimeout(aliasAutoSaveTimeout);
        }
        
        // Set new timeout for auto-save (2 seconds after last change)
        aliasAutoSaveTimeout = setTimeout(async () => {
            await saveAliases();
        }, 2000);
    });
    
    // Manual save
    saveButton.addEventListener('click', async () => {
        await saveAliases();
    });
    
    // Clear all aliases
    clearAllButton.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear all aliases? This will remove all MyShell24-managed aliases from your .zshrc file.')) {
            const aliasesEditor = document.getElementById('aliases-editor');
            aliasesEditor.value = '';
            aliasHasUnsavedChanges = true;
            await saveAliases();
        }
    });
    
    // Auto-save when page is about to unload
    window.addEventListener('beforeunload', async (e) => {
        if (aliasHasUnsavedChanges) {
            // Try to save before leaving
            await saveAliases();
        }
    });
}

// Save aliases
async function saveAliases() {
    try {
        const aliasesEditor = document.getElementById('aliases-editor');
        const text = aliasesEditor.value;
        
        updateAliasSaveStatus('Saving...');
        
        const response = await fetch('/api/aliases', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        });
        
        if (response.ok) {
            const result = await response.json();
            aliasHasUnsavedChanges = false;
            updateAliasSaveStatus(`Saved (${result.aliasCount || 0} aliases)`);
            
            // Clear auto-save timeout
            if (aliasAutoSaveTimeout) {
                clearTimeout(aliasAutoSaveTimeout);
                aliasAutoSaveTimeout = null;
            }
        } else {
            const error = await response.json();
            updateAliasSaveStatus('Save failed');
            console.error('Failed to save aliases:', error);
            
            // Show detailed error if available
            if (error.details && error.details.length > 0) {
                alert('Save failed:\n' + error.details.join('\n'));
            }
        }
    } catch (error) {
        updateAliasSaveStatus('Save error');
        console.error('Error saving aliases:', error);
    }
}

// Update save status display
function updateAliasSaveStatus(status) {
    const saveStatus = document.getElementById('alias-save-status');
    if (saveStatus) {
        saveStatus.textContent = status;
        
        // Add visual feedback
        saveStatus.className = 'text-sm transition-colors duration-200';
        
        if (status.includes('Saved')) {
            saveStatus.className += ' text-success';
        } else if (status.includes('Saving')) {
            saveStatus.className += ' text-warning';
        } else if (status.includes('failed') || status.includes('error')) {
            saveStatus.className += ' text-error';
        } else {
            saveStatus.className += ' opacity-70';
        }
        
        // Clear status after 3 seconds for success/error messages
        if (status.includes('Saved') || status.includes('failed') || status.includes('error')) {
            setTimeout(() => {
                if (saveStatus.textContent === status) {
                    saveStatus.textContent = '';
                }
            }, 3000);
        }
    }
}

// Export functions for global access
window.showAliasesManager = showAliasesManager;