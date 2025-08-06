// Command aliases management functionality

let aliasAutoSaveTimeout = null;
let aliasHasUnsavedChanges = false;

// Function to show aliases management interface
async function showAliasesManager() {
    try {
        const response = await fetch('/api/aliases');
        const data = await response.json();
        
        const terminalContainer = document.getElementById('terminal-container');
        terminalContainer.innerHTML = `
            <div class="p-6 max-w-4xl mx-auto h-full flex flex-col">
                <div class="flex items-center justify-between mb-6">
                    <h1 class="text-3xl font-bold">Command Aliases</h1>
                    <div class="flex gap-2">
                        <span id="alias-save-status" class="text-sm opacity-70"></span>
                        <button id="back-to-dashboard" class="btn btn-outline">← Back to Dashboard</button>
                    </div>
                </div>
                
                <div class="bg-base-200 rounded-lg p-4 mb-6">
                    <p class="text-sm opacity-70 mb-2">
                        Define command aliases in JSON format. When you type the alias name, it will be replaced with the full command.
                        Changes are automatically saved as you type.
                    </p>
                    <p class="text-xs opacity-50">
                        Example: {"qwen": "qwen --yolo", "gemini": "gemini --yolo"}
                    </p>
                </div>
                
                <div class="flex-1 flex flex-col">
                    <div class="flex items-center justify-between mb-4">
                        <h2 class="text-xl font-semibold">Aliases Configuration</h2>
                        <div class="flex gap-2">
                            <button id="save-aliases-manually" class="btn btn-sm btn-primary">Save Now</button>
                            <button id="clear-all-aliases" class="btn btn-sm btn-error">Clear All</button>
                        </div>
                    </div>
                    
                    <div class="flex-1 bg-base-100 rounded-lg border border-base-300">
                        <textarea 
                            id="aliases-editor" 
                            class="textarea textarea-ghost w-full h-full resize-none font-mono text-sm leading-relaxed p-4" 
                            placeholder="{\n  \"qwen\": \"qwen --yolo\",\n  \"gemini\": \"gemini --yolo\"\n}"
                            spellcheck="false"
                        ></textarea>
                    </div>
                </div>
            </div>
        `;
        
        // Populate the editor with current aliases
        const aliasesEditor = document.getElementById('aliases-editor');
        if (data.success && data.aliases) {
            aliasesEditor.value = JSON.stringify(data.aliases, null, 2);
        }
        
        // Setup event listeners
        setupAliasesEventListeners();
        
        // Update save status
        updateAliasSaveStatus('Ready');
        
    } catch (error) {
        console.error('Error loading aliases manager:', error);
        alert('Failed to load aliases manager');
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
        if (confirm('Are you sure you want to clear all aliases?')) {
            const aliasesEditor = document.getElementById('aliases-editor');
            aliasesEditor.value = '{}';
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

// Save aliases to server
async function saveAliases() {
    try {
        updateAliasSaveStatus('Saving...');
        
        const aliasesEditor = document.getElementById('aliases-editor');
        const aliasesText = aliasesEditor.value.trim();
        
        let aliases = {};
        if (aliasesText) {
            try {
                aliases = JSON.parse(aliasesText);
            } catch (parseError) {
                updateAliasSaveStatus('Save failed: Invalid JSON format');
                return;
            }
        }
        
        const response = await fetch('/api/aliases', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ aliases })
        });
        
        const result = await response.json();
        
        if (result.success) {
            aliasHasUnsavedChanges = false;
            updateAliasSaveStatus('Saved successfully');
        } else {
            updateAliasSaveStatus(`Save failed: ${result.error}`);
        }
        
    } catch (error) {
        console.error('Error saving aliases:', error);
        updateAliasSaveStatus('Save failed: Network error');
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

// Load aliases from server
async function loadAliasesFromServer() {
    try {
        const response = await fetch('/api/aliases');
        const data = await response.json();
        
        if (data.success) {
            return data.aliases || {};
        }
    } catch (error) {
        console.error('Error loading aliases:', error);
    }
    
    return {};
}

// Export functions for global access
window.showAliasesManager = showAliasesManager;
window.loadAliasesFromServer = loadAliasesFromServer;