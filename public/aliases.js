// Settings management functionality

let settingsAutoSaveTimeout = null;
let settingsHasUnsavedChanges = false;

// Function to show settings management interface
async function showSettingsManager() {
    try {
        const response = await fetch('/api/settings');
        const data = await response.json();
        
        const terminalContainer = document.getElementById('terminal-container');
        terminalContainer.innerHTML = `
            <div class="p-6 max-w-4xl mx-auto h-full flex flex-col">
                <div class="flex items-center justify-between mb-6">
                    <h1 class="text-3xl font-bold">Settings</h1>
                    <div class="flex gap-2">
                        <span id="settings-save-status" class="text-sm opacity-70"></span>
                        <button id="back-to-dashboard" class="btn btn-outline">← Back to Dashboard</button>
                    </div>
                </div>
                
                <div class="bg-base-200 rounded-lg p-4 mb-6">
                    <div class="text-xs opacity-50">
                        <strong>Location:</strong> ${data.settingsPath || '~/.myshell24/settings.conf'}
                        ${data.hasFile ? '<span class="text-success">✓ Found</span>' : '<span class="text-warning">⚠ Will be created</span>'}
                    </div>
                </div>
                
                <!-- Text Editor Section -->
                <div class="bg-base-100 rounded-lg border border-base-300 flex-1 flex flex-col">
                    <div class="flex items-center justify-between p-4 border-b border-base-300">
                        <h2 class="text-xl font-semibold">Configuration</h2>
                        <div class="flex gap-2">
                            <button id="save-settings-manually" class="btn btn-primary btn-sm">Save Now</button>
                        </div>
                    </div>
                    
                    <div class="flex-1 p-4">
                        <textarea 
                            id="settings-editor" 
                            class="textarea textarea-bordered w-full h-full resize-none font-mono text-sm" 
                            placeholder="# Add any settings you want here (free-form text)\n# This file is saved to ~/.myshell24/settings.conf"
                            spellcheck="false"
                        >${data.text || ''}</textarea>
                    </div>
                </div>
            </div>
        `;
        
        setupSettingsEventListeners();
        updateSettingsSaveStatus('Loaded');
        
    } catch (error) {
        console.error('Error loading settings:', error);
        alert('Failed to load settings');
    }
}

// Setup event listeners for settings management
function setupSettingsEventListeners() {
    const backButton = document.getElementById('back-to-dashboard');
    const settingsEditor = document.getElementById('settings-editor');
    const saveButton = document.getElementById('save-settings-manually');
    
    // Back to dashboard with auto-save
    backButton.addEventListener('click', async () => {
        if (settingsHasUnsavedChanges) {
            await saveSettings();
        }
        showSessionsAndProjectsList();
    });
    
    // Auto-save on text change
    settingsEditor.addEventListener('input', () => {
        settingsHasUnsavedChanges = true;
        updateSettingsSaveStatus('Unsaved changes...');
        
        // Clear existing timeout
        if (settingsAutoSaveTimeout) {
            clearTimeout(settingsAutoSaveTimeout);
        }
        
        // Set new timeout for auto-save (2 seconds after last change)
        settingsAutoSaveTimeout = setTimeout(async () => {
            await saveSettings();
        }, 2000);
    });
    
    // Manual save
    saveButton.addEventListener('click', async () => {
        await saveSettings();
    });
    
    // Auto-save when page is about to unload
    window.addEventListener('beforeunload', async (e) => {
        if (settingsHasUnsavedChanges) {
            // Try to save before leaving
            await saveSettings();
        }
    });
}

// Save settings
async function saveSettings() {
    try {
        const settingsEditor = document.getElementById('settings-editor');
        const text = settingsEditor.value;
        
        updateSettingsSaveStatus('Saving...');
        
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text })
        });
        
        if (response.ok) {
            const result = await response.json();
            settingsHasUnsavedChanges = false;
            updateSettingsSaveStatus('Saved');
            
            // Clear auto-save timeout
            if (settingsAutoSaveTimeout) {
                clearTimeout(settingsAutoSaveTimeout);
                settingsAutoSaveTimeout = null;
            }
        } else {
            const error = await response.json();
            updateSettingsSaveStatus('Save failed');
            console.error('Failed to save settings:', error);
        }
    } catch (error) {
        updateSettingsSaveStatus('Save error');
        console.error('Error saving settings:', error);
    }
}

// Update save status display
function updateSettingsSaveStatus(status) {
    const saveStatus = document.getElementById('settings-save-status');
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
window.showSettingsManager = showSettingsManager;