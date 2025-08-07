// Environment variables management functionality

let autoSaveTimeout = null;
let hasUnsavedChanges = false;

// Function to show environment variables management interface
async function showEnvironmentManager() {
    try {
        const response = await fetch('/api/environment');
        const data = await response.json();
        
        const terminalContainer = document.getElementById('terminal-container');
        terminalContainer.innerHTML = `
            <div class="p-6 max-w-4xl mx-auto h-full flex flex-col">
                <div class="flex items-center justify-between mb-6">
                    <h1 class="text-3xl font-bold">Global Environment Variables</h1>
                    <div class="flex gap-2">
                        <span id="save-status" class="text-sm opacity-70"></span>
                        <button id="back-to-dashboard" class="btn btn-outline">← Back to Dashboard</button>
                    </div>
                </div>
                
                <div class="bg-base-200 rounded-lg p-4 mb-6">
                    <p class="text-sm opacity-70 mb-2">
                        Edit environment variables in KEY=VALUE format. Comments starting with # are ignored.
                        These variables will be available in all new terminal sessions across all projects.
                        Changes are automatically saved as you type.
                    </p>
                    <p class="text-xs opacity-50">
                        Example: NODE_ENV=production
                    </p>
                </div>
                
                <!-- Text Editor Section -->
                <div class="bg-base-100 rounded-lg border border-base-300 flex-1 flex flex-col">
                    <div class="flex items-center justify-between p-4 border-b border-base-300">
                        <h2 class="text-xl font-semibold">Environment Variables</h2>
                        <div class="flex gap-2">
                            <button id="edit-zsh-settings" class="btn btn-secondary btn-sm">⚙️ Edit Zsh Settings</button>
                            <button id="clear-all-vars" class="btn btn-error btn-sm">Clear All</button>
                            <button id="save-manually" class="btn btn-primary btn-sm">Save Now</button>
                        </div>
                    </div>
                    
                    <div class="flex-1 p-4">
                        <textarea 
                            id="env-editor" 
                            class="textarea textarea-bordered w-full h-full resize-none font-mono text-sm" 
                            placeholder="# Add your environment variables here\n# Format: KEY=VALUE\n# Example:\nNODE_ENV=production\nAPI_URL=https://api.example.com\nDEBUG=true"
                            spellcheck="false"
                        >${data.text || ''}</textarea>
                    </div>
                </div>
            </div>
        `;
        
        setupEnvironmentEventListeners();
        updateSaveStatus('Loaded');
        
    } catch (error) {
        console.error('Error loading environment variables:', error);
        alert('Failed to load environment variables');
    }
}

// Setup event listeners for environment management
function setupEnvironmentEventListeners() {
    const backButton = document.getElementById('back-to-dashboard');
    const envEditor = document.getElementById('env-editor');
    const clearAllButton = document.getElementById('clear-all-vars');
    const saveButton = document.getElementById('save-manually');
    const zshSettingsButton = document.getElementById('edit-zsh-settings');
    
    // Back to dashboard with auto-save
     backButton.addEventListener('click', async () => {
         if (hasUnsavedChanges) {
             await saveEnvironmentVariables();
         }
         showSessionsAndProjectsList();
     });
    
    // Auto-save on text change
    envEditor.addEventListener('input', () => {
        hasUnsavedChanges = true;
        updateSaveStatus('Unsaved changes...');
        
        // Clear existing timeout
        if (autoSaveTimeout) {
            clearTimeout(autoSaveTimeout);
        }
        
        // Set new timeout for auto-save (2 seconds after last change)
        autoSaveTimeout = setTimeout(async () => {
            await saveEnvironmentVariables();
        }, 2000);
    });
    
    // Manual save
    saveButton.addEventListener('click', async () => {
        await saveEnvironmentVariables();
    });
    
    // Clear all variables
    clearAllButton.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear all environment variables?')) {
            const envEditor = document.getElementById('env-editor');
            envEditor.value = '';
            hasUnsavedChanges = true;
            await saveEnvironmentVariables();
        }
    });
    
    // Edit zsh settings
    zshSettingsButton.addEventListener('click', async () => {
        await showZshSettingsEditor();
    });
    
    // Auto-save when page is about to unload
    window.addEventListener('beforeunload', async (e) => {
        if (hasUnsavedChanges) {
            // Try to save before leaving
            await saveEnvironmentVariables();
        }
    });
}

// Save environment variables
async function saveEnvironmentVariables() {
    try {
        const envEditor = document.getElementById('env-editor');
        const text = envEditor.value;
        
        updateSaveStatus('Saving...');
        
        const response = await fetch('/api/environment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        });
        
        if (response.ok) {
            const result = await response.json();
            hasUnsavedChanges = false;
            updateSaveStatus(`Saved (${Object.keys(result.variables).length} variables)`);
            
            // Clear auto-save timeout
            if (autoSaveTimeout) {
                clearTimeout(autoSaveTimeout);
                autoSaveTimeout = null;
            }
        } else {
            const error = await response.json();
            updateSaveStatus('Save failed');
            console.error('Failed to save environment variables:', error);
        }
    } catch (error) {
        updateSaveStatus('Save error');
        console.error('Error saving environment variables:', error);
    }
}

// Update save status display
function updateSaveStatus(status) {
    const saveStatus = document.getElementById('save-status');
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
// Function to show zsh settings editor
async function showZshSettingsEditor() {
    try {
        // Read the current .zshrc file
        const response = await fetch(`/api/files/file?path=${encodeURIComponent('~/.zshrc')}`, {
            method: 'GET'
        });
        
        let zshrcContent = '';
        if (response.ok) {
            const data = await response.json();
            zshrcContent = data.content || '';
        }
        
        const terminalContainer = document.getElementById('terminal-container');
        terminalContainer.innerHTML = `
            <div class="p-6 max-w-4xl mx-auto h-full flex flex-col">
                <div class="flex items-center justify-between mb-6">
                    <h1 class="text-3xl font-bold">Zsh Settings Editor</h1>
                    <div class="flex gap-2">
                        <span id="zsh-save-status" class="text-sm opacity-70"></span>
                        <button id="back-to-env-manager" class="btn btn-outline">← Back to Environment</button>
                    </div>
                </div>
                
                <div class="bg-base-200 rounded-lg p-4 mb-6">
                    <p class="text-sm opacity-70 mb-2">
                        Edit your .zshrc configuration file. This file contains shell settings, aliases, functions, and startup commands.
                        Changes will take effect in new terminal sessions.
                    </p>
                    <p class="text-xs opacity-50">
                        File location: ~/.zshrc
                    </p>
                </div>
                
                <!-- Text Editor Section -->
                <div class="bg-base-100 rounded-lg border border-base-300 flex-1 flex flex-col">
                    <div class="flex items-center justify-between p-4 border-b border-base-300">
                        <h2 class="text-xl font-semibold">Zsh Configuration</h2>
                        <div class="flex gap-2">
                            <button id="save-zsh-settings" class="btn btn-primary btn-sm">Save .zshrc</button>
                        </div>
                    </div>
                    
                    <div class="flex-1 p-4">
                        <textarea 
                            id="zsh-editor" 
                            class="textarea textarea-bordered w-full h-full resize-none font-mono text-sm" 
                            placeholder="# Zsh configuration file\n# Add your aliases, functions, and settings here\n# Example:\nalias ll='ls -la'\nexport PATH=$PATH:/usr/local/bin"
                            spellcheck="false"
                        >${zshrcContent}</textarea>
                    </div>
                </div>
            </div>
        `;
        
        setupZshSettingsEventListeners();
        updateZshSaveStatus('Loaded');
        
    } catch (error) {
        console.error('Error loading zsh settings:', error);
        alert('Failed to load zsh settings');
    }
}

// Setup event listeners for zsh settings management
function setupZshSettingsEventListeners() {
    const backButton = document.getElementById('back-to-env-manager');
    const zshEditor = document.getElementById('zsh-editor');
    const saveButton = document.getElementById('save-zsh-settings');
    
    // Back to environment manager
    backButton.addEventListener('click', () => {
        showEnvironmentManager();
    });
    
    // Save zsh settings
    saveButton.addEventListener('click', async () => {
        await saveZshSettings();
    });
    
    // Auto-save indication on text change
    zshEditor.addEventListener('input', () => {
        updateZshSaveStatus('Unsaved changes...');
    });
}

// Function to save zsh settings
async function saveZshSettings() {
    try {
        updateZshSaveStatus('Saving...');
        
        const zshEditor = document.getElementById('zsh-editor');
        const content = zshEditor.value;
        
        const response = await fetch('/api/files/file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                path: '~/.zshrc',
                content: content
            })
        });
        
        if (response.ok) {
            updateZshSaveStatus('Saved successfully');
            setTimeout(() => updateZshSaveStatus(''), 3000);
        } else {
            throw new Error('Failed to save file');
        }
        
    } catch (error) {
        console.error('Error saving zsh settings:', error);
        updateZshSaveStatus('Error saving file');
        alert('Failed to save zsh settings');
    }
}

// Function to update zsh save status
function updateZshSaveStatus(status) {
    const statusElement = document.getElementById('zsh-save-status');
    if (statusElement) {
        statusElement.textContent = status;
        
        // Add visual feedback
        statusElement.className = 'text-sm opacity-70';
        if (status.includes('Error') || status.includes('Failed')) {
            statusElement.className += ' text-error';
        } else if (status.includes('Saved')) {
            statusElement.className += ' text-success';
        } else if (status.includes('Saving')) {
            statusElement.className += ' text-warning';
        }
    }
}

window.showEnvironmentManager = showEnvironmentManager;