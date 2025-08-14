// Settings management functionality (rules only)

let aliasAutoSaveTimeout = null;
let aliasHasUnsavedChanges = false;

// Function to show settings interface
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
                        <strong>Rules file:</strong> ${data.rulesPath || '(local rules)'}
                        ${data.hasRules ? '<span class="text-success">✓ Found</span>' : '<span class="text-warning">⚠ Will be created</span>'}
                    </div>
                </div>
                
                <!-- Text Editor Section -->
                <div class="bg-base-100 rounded-lg border border-base-300 flex-1 flex flex-col">
                    <div class="flex items-center justify-between p-4 border-b border-base-300">
                        <h2 class="text-xl font-semibold">Global Rules</h2>
                        <div class="flex gap-2">
                            <button id="save-aliases-manually" class="btn btn-primary btn-sm">Save Now</button>
                        </div>
                    </div>
                    
                    <div class="flex-1 p-4">
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
        console.error('Error loading rules:', error);
        alert('Failed to load rules');
    }
}

// Setup event listeners for aliases management
function setupAliasesEventListeners() {
    const backButton = document.getElementById('back-to-dashboard');
    const rulesEditor = document.getElementById('rules-editor');
    const saveButton = document.getElementById('save-aliases-manually');
    
    // Back to dashboard with auto-save
    backButton.addEventListener('click', async () => {
        if (aliasHasUnsavedChanges) {
            await saveAliases();
        }
        showSessionsAndProjectsList();
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
    
    saveButton.addEventListener('click', async () => {
        await saveRules();
    });
    
    // Auto-save when page is about to unload
    window.addEventListener('beforeunload', async (e) => {
        if (aliasHasUnsavedChanges) {
            // Try to save before leaving
            await saveRules();
        }
    });
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