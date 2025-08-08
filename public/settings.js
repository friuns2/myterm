// Generic settings management functionality

let settingsAutoSaveTimeout = null;
let settingsHaveUnsavedChanges = false;

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
                <div class="bg-base-200 rounded-lg p-4 mb-6 text-xs opacity-50">
                    <strong>File:</strong> ${data.path || '~/.myshell-settings'}
                </div>
                <div class="bg-base-100 rounded-lg border border-base-300 flex-1 flex flex-col">
                    <div class="flex items-center justify-between p-4 border-b border-base-300">
                        <h2 class="text-xl font-semibold">Configuration</h2>
                        <div class="flex gap-2">
                            <button id="save-settings-manually" class="btn btn-primary btn-sm">Save Now</button>
                        </div>
                    </div>
                    <div class="flex-1 p-4">
                        <textarea id="settings-editor" class="textarea textarea-bordered w-full h-full resize-none font-mono text-sm" placeholder="# Key=Value pairs or free-form text\n# Example:\n# defaultProject=myproject\n# theme=dark" spellcheck="false">${data.text || ''}</textarea>
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

function setupSettingsEventListeners() {
    const backButton = document.getElementById('back-to-dashboard');
    const editor = document.getElementById('settings-editor');
    const saveButton = document.getElementById('save-settings-manually');

    backButton.addEventListener('click', async () => {
        if (settingsHaveUnsavedChanges) {
            await saveSettings();
        }
        showSessionsAndProjectsList();
    });

    editor.addEventListener('input', () => {
        settingsHaveUnsavedChanges = true;
        updateSettingsSaveStatus('Unsaved changes...');
        if (settingsAutoSaveTimeout) clearTimeout(settingsAutoSaveTimeout);
        settingsAutoSaveTimeout = setTimeout(async () => {
            await saveSettings();
        }, 2000);
    });

    saveButton.addEventListener('click', async () => {
        await saveSettings();
    });

    window.addEventListener('beforeunload', async () => {
        if (settingsHaveUnsavedChanges) {
            await saveSettings();
        }
    });
}

async function saveSettings() {
    try {
        const editor = document.getElementById('settings-editor');
        const text = editor.value;
        updateSettingsSaveStatus('Saving...');
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        if (response.ok) {
            const result = await response.json();
            settingsHaveUnsavedChanges = false;
            updateSettingsSaveStatus(`Saved (${result.size || text.length} bytes)`);
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

function updateSettingsSaveStatus(status) {
    const saveStatus = document.getElementById('settings-save-status');
    if (!saveStatus) return;
    saveStatus.textContent = status;
    saveStatus.className = 'text-sm transition-colors duration-200';
    if (status.includes('Saved')) saveStatus.className += ' text-success';
    else if (status.includes('Saving')) saveStatus.className += ' text-warning';
    else if (status.includes('failed') || status.includes('error')) saveStatus.className += ' text-error';
    else saveStatus.className += ' opacity-70';
    if (status.includes('Saved') || status.includes('failed') || status.includes('error')) {
        setTimeout(() => { if (saveStatus.textContent === status) saveStatus.textContent = ''; }, 3000);
    }
}

window.showSettingsManager = showSettingsManager;


