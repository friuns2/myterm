// Shell settings management functionality

let aliasAutoSaveTimeout = null;
let aliasHasUnsavedChanges = false;

// Function to show aliases management interface
async function showSettingsManager() {
    try {
        const response = await fetch('/api/settings');
        const data = await response.json();
        
        const terminalContainer = document.getElementById('terminal-container');
        terminalContainer.innerHTML = `
            <div class="p-6 max-w-4xl mx-auto h-full flex flex-col">
                <div class="flex items-center justify-between mb-6">
                    <h1 class="text-3xl font-bold">Shell Settings</h1>
                    <div class="flex gap-2">
                        <button id="back-to-dashboard" class="btn btn-outline">← Back to Dashboard</button>
                    </div>
                </div>
                
                <div class="bg-base-200 rounded-lg p-4 mb-6">
                    <div class="text-xs opacity-50">
                        <strong>Settings file:</strong> ${data.zshrcPath || '~/.zshrc'}
                        ${data.hasZshrc ? '<span class="text-success">✓ Found</span>' : '<span class="text-warning">⚠ Will be created</span>'}
                        <span class="ml-4"></span>
                        <strong>Rules file:</strong> ${data.rulesPath || '(local rules)'}
                        ${data.hasRules ? '<span class="text-success">✓ Found</span>' : '<span class="text-warning">⚠ Will be created</span>'}
                    </div>
                </div>
                
                <!-- Text Editor Section -->
                <div class="bg-base-100 rounded-lg border border-base-300 flex-1 flex flex-col">
                    <div class="flex items-center justify-between p-4 border-b border-base-300">
                        <h2 class="text-xl font-semibold">Shell Settings & Global Rules</h2>
                        <div class="flex gap-2">
                            <button id="clear-all-aliases" class="btn btn-error btn-sm" hidden>Clear Settings</button>
                            <button id="save-aliases-manually" class="btn btn-primary btn-sm">Save Now</button>
                        </div>
                    </div>
                    
                    <div class="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <textarea 
                            id="aliases-editor" 
                            class="textarea textarea-bordered w-full h-full resize-none font-mono text-sm" 
                            placeholder="# Add your shell settings here\n# Examples:\nalias ll='ls -la'\nalias gs='git status'\nalias ..='cd ..'\nalias grep='grep --color=auto'\nalias h='history'\nalias c='clear'"
                            spellcheck="false"
                        >${data.text || ''}</textarea>

                        <textarea 
                            id="rules-editor" 
                            class="textarea textarea-bordered w-full h-full resize-none font-mono text-sm" 
                            placeholder="# Add global rules for CLI agents (Gemini, Qwen, Claude Code, OpenCode)\n# These will be exported to new shells and can be synced to each tool's config."
                            spellcheck="false"
                        >${data.rulesText || ''}</textarea>
                    </div>
                </div>
            </div>
        `;
        
        setupAliasesEventListeners();
        // No status display
        
    } catch (error) {
        console.error('Error loading aliases:', error);
        alert('Failed to load aliases');
    }
}

// Setup event listeners for aliases management
function setupAliasesEventListeners() {
    const backButton = document.getElementById('back-to-dashboard');
    const settingsEditor = document.getElementById('aliases-editor');
    const rulesEditor = document.getElementById('rules-editor');
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
    settingsEditor.addEventListener('input', () => {
        aliasHasUnsavedChanges = true;
        
        // Clear existing timeout
        if (aliasAutoSaveTimeout) {
            clearTimeout(aliasAutoSaveTimeout);
        }
        
        // Set new timeout for auto-save (2 seconds after last change)
        aliasAutoSaveTimeout = setTimeout(async () => {
            await saveAliases();
        }, 2000);
    });
    rulesEditor.addEventListener('input', () => {
        aliasHasUnsavedChanges = true;
        if (aliasAutoSaveTimeout) {
            clearTimeout(aliasAutoSaveTimeout);
        }
        aliasAutoSaveTimeout = setTimeout(async () => {
            await saveRules();
        }, 2000);
    });
    
    // Manual save
    saveButton.addEventListener('click', async () => {
        await saveAliases();
        await saveRules();
    });
    
    // Clear all aliases
    clearAllButton.addEventListener('click', async () => {
        if (confirm('Are you sure you want to clear all shell settings? This will remove all MyShell24-managed settings from your configuration.')) {
            const settingsEditor = document.getElementById('aliases-editor');
            settingsEditor.value = '';
            aliasHasUnsavedChanges = true;
            await saveAliases();
        }
    });
    
    // Auto-save when page is about to unload
    window.addEventListener('beforeunload', async (e) => {
        if (aliasHasUnsavedChanges) {
            // Try to save before leaving
            await saveAliases();
            await saveRules();
        }
    });
}

// Save aliases
async function saveAliases() {
    try {
        const settingsEditor = document.getElementById('aliases-editor');
        const text = settingsEditor.value;
        
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        });
        
        if (response.ok) {
            aliasHasUnsavedChanges = false;
            // Clear auto-save timeout
            if (aliasAutoSaveTimeout) {
                clearTimeout(aliasAutoSaveTimeout);
                aliasAutoSaveTimeout = null;
            }
        } else {
            const error = await response.json();
            console.error('Failed to save aliases:', error);
        }
    } catch (error) {
        console.error('Error saving aliases:', error);
    }
}

// Save rules
async function saveRules() {
    try {
        const rulesEditor = document.getElementById('rules-editor');
        const text = rulesEditor.value;
        const response = await fetch('/api/settings/rules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        if (!response.ok) {
            const error = await response.json();
            console.error('Failed to save rules:', error);
        }
    } catch (error) {
        console.error('Error saving rules:', error);
    }
}

// Export functions for global access
window.showSettingsManager = showSettingsManager;