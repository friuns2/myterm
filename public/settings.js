// Settings management functionality

let settingsHasUnsavedChanges = false;
let settingsAutoSaveTimeout = null;

// Function to show settings management interface
async function showSettingsManager() {
    try {
        const currentSettings = getAppSettings();
        
        const terminalContainer = document.getElementById('terminal-container');
        terminalContainer.innerHTML = `
            <div class="p-6 max-w-4xl mx-auto h-full flex flex-col">
                <div class="flex items-center justify-between mb-6">
                    <h1 class="text-3xl font-bold">Application Settings</h1>
                    <div class="flex gap-2">
                        <span id="settings-save-status" class="text-sm opacity-70"></span>
                        <button id="back-to-dashboard" class="btn btn-outline">← Back to Dashboard</button>
                    </div>
                </div>
                
                <div class="bg-base-200 rounded-lg p-4 mb-6">
                    <p class="text-sm opacity-70 mb-2">
                        Configure application preferences and URL parameters. Settings are automatically saved to local storage.
                        Some settings can also be controlled via URL parameters for sharing specific configurations.
                    </p>
                </div>

                <div class="flex-1 overflow-y-auto space-y-6">
                    <!-- Theme Settings -->
                    <div class="card bg-base-100 shadow-xl">
                        <div class="card-body">
                            <h2 class="card-title">Appearance</h2>
                            <div class="form-control">
                                <label class="label">
                                    <span class="label-text">Theme</span>
                                </label>
                                <select id="theme-select" class="select select-bordered w-full max-w-xs">
                                    <option value="dark" ${currentSettings.theme === 'dark' ? 'selected' : ''}>Dark</option>
                                    <option value="light" ${currentSettings.theme === 'light' ? 'selected' : ''}>Light</option>
                                    <option value="auto" ${currentSettings.theme === 'auto' ? 'selected' : ''}>Auto</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Terminal Settings -->
                    <div class="card bg-base-100 shadow-xl">
                        <div class="card-body">
                            <h2 class="card-title">Terminal</h2>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="form-control">
                                    <label class="label">
                                        <span class="label-text">Font Size</span>
                                    </label>
                                    <input type="range" id="font-size-range" min="10" max="24" value="${currentSettings.fontSize}" class="range range-primary" />
                                    <div class="w-full flex justify-between text-xs px-2">
                                        <span>10px</span>
                                        <span id="font-size-value">${currentSettings.fontSize}px</span>
                                        <span>24px</span>
                                    </div>
                                </div>
                                <div class="form-control">
                                    <label class="label">
                                        <span class="label-text">Terminal Columns</span>
                                    </label>
                                    <input type="number" id="terminal-cols" min="40" max="200" value="${currentSettings.terminalCols}" class="input input-bordered" />
                                </div>
                                <div class="form-control">
                                    <label class="label">
                                        <span class="label-text">Terminal Rows</span>
                                    </label>
                                    <input type="number" id="terminal-rows" min="10" max="100" value="${currentSettings.terminalRows}" class="input input-bordered" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Editor Settings -->
                    <div class="card bg-base-100 shadow-xl">
                        <div class="card-body">
                            <h2 class="card-title">Editor</h2>
                            <div class="space-y-4">
                                <div class="form-control">
                                    <label class="cursor-pointer label">
                                        <span class="label-text">Auto-save changes</span>
                                        <input type="checkbox" id="auto-save-checkbox" ${currentSettings.autoSave ? 'checked' : ''} class="checkbox checkbox-primary" />
                                    </label>
                                </div>
                                <div class="form-control">
                                    <label class="cursor-pointer label">
                                        <span class="label-text">Show line numbers</span>
                                        <input type="checkbox" id="line-numbers-checkbox" ${currentSettings.showLineNumbers ? 'checked' : ''} class="checkbox checkbox-primary" />
                                    </label>
                                </div>
                                <div class="form-control">
                                    <label class="cursor-pointer label">
                                        <span class="label-text">Word wrap</span>
                                        <input type="checkbox" id="word-wrap-checkbox" ${currentSettings.wordWrap ? 'checked' : ''} class="checkbox checkbox-primary" />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- URL Parameters -->
                    <div class="card bg-base-100 shadow-xl">
                        <div class="card-body">
                            <h2 class="card-title">URL Parameters</h2>
                            <p class="text-sm opacity-70 mb-4">
                                Current URL parameters. Session and project parameters are temporary and cleared when navigating.
                            </p>
                            <div class="overflow-x-auto">
                                <table class="table table-zebra w-full">
                                    <thead>
                                        <tr>
                                            <th>Parameter</th>
                                            <th>Value</th>
                                            <th>Type</th>
                                            <th>Persistent</th>
                                        </tr>
                                    </thead>
                                    <tbody id="url-params-table">
                                        <!-- Will be populated by JavaScript -->
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- Import/Export -->
                    <div class="card bg-base-100 shadow-xl">
                        <div class="card-body">
                            <h2 class="card-title">Import/Export Settings</h2>
                            <div class="space-y-4">
                                <div class="form-control">
                                    <label class="label">
                                        <span class="label-text">Export current settings</span>
                                    </label>
                                    <div class="flex gap-2">
                                        <button id="export-settings" class="btn btn-outline">Export to JSON</button>
                                        <button id="copy-settings" class="btn btn-outline">Copy to Clipboard</button>
                                    </div>
                                </div>
                                <div class="form-control">
                                    <label class="label">
                                        <span class="label-text">Import settings from JSON</span>
                                    </label>
                                    <textarea id="import-settings-text" class="textarea textarea-bordered" placeholder="Paste JSON settings here..."></textarea>
                                    <div class="flex gap-2 mt-2">
                                        <button id="import-settings" class="btn btn-primary">Import Settings</button>
                                        <button id="reset-settings" class="btn btn-error">Reset to Defaults</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        setupSettingsEventListeners();
        updateURLParamsTable();
        
    } catch (error) {
        console.error('Error showing settings manager:', error);
    }
}

// Setup event listeners for settings management
function setupSettingsEventListeners() {
    const backButton = document.getElementById('back-to-dashboard');
    
    // Back to dashboard
    backButton.addEventListener('click', () => {
        showSessionsAndProjectsList();
    });
    
    // Theme selection
    const themeSelect = document.getElementById('theme-select');
    themeSelect.addEventListener('change', (e) => {
        updateAppSetting('theme', e.target.value);
        updateSettingsSaveStatus('Theme updated');
        applyTheme(e.target.value);
    });
    
    // Font size
    const fontSizeRange = document.getElementById('font-size-range');
    const fontSizeValue = document.getElementById('font-size-value');
    fontSizeRange.addEventListener('input', (e) => {
        const size = parseInt(e.target.value);
        fontSizeValue.textContent = `${size}px`;
        updateAppSetting('fontSize', size);
        updateSettingsSaveStatus('Font size updated');
        applyFontSize(size);
    });
    
    // Terminal dimensions
    const terminalCols = document.getElementById('terminal-cols');
    const terminalRows = document.getElementById('terminal-rows');
    
    terminalCols.addEventListener('change', (e) => {
        const cols = parseInt(e.target.value);
        updateAppSetting('terminalCols', cols);
        updateSettingsSaveStatus('Terminal columns updated');
    });
    
    terminalRows.addEventListener('change', (e) => {
        const rows = parseInt(e.target.value);
        updateAppSetting('terminalRows', rows);
        updateSettingsSaveStatus('Terminal rows updated');
    });
    
    // Checkboxes
    const autoSaveCheckbox = document.getElementById('auto-save-checkbox');
    const lineNumbersCheckbox = document.getElementById('line-numbers-checkbox');
    const wordWrapCheckbox = document.getElementById('word-wrap-checkbox');
    
    autoSaveCheckbox.addEventListener('change', (e) => {
        updateAppSetting('autoSave', e.target.checked);
        updateSettingsSaveStatus('Auto-save preference updated');
    });
    
    lineNumbersCheckbox.addEventListener('change', (e) => {
        updateAppSetting('showLineNumbers', e.target.checked);
        updateSettingsSaveStatus('Line numbers preference updated');
    });
    
    wordWrapCheckbox.addEventListener('change', (e) => {
        updateAppSetting('wordWrap', e.target.checked);
        updateSettingsSaveStatus('Word wrap preference updated');
    });
    
    // Import/Export
    const exportButton = document.getElementById('export-settings');
    const copyButton = document.getElementById('copy-settings');
    const importButton = document.getElementById('import-settings');
    const resetButton = document.getElementById('reset-settings');
    const importText = document.getElementById('import-settings-text');
    
    exportButton.addEventListener('click', () => {
        const settings = exportAppSettings();
        const blob = new Blob([settings], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'myshell24-settings.json';
        a.click();
        URL.revokeObjectURL(url);
        updateSettingsSaveStatus('Settings exported');
    });
    
    copyButton.addEventListener('click', async () => {
        try {
            const settings = exportAppSettings();
            await navigator.clipboard.writeText(settings);
            updateSettingsSaveStatus('Settings copied to clipboard');
        } catch (error) {
            updateSettingsSaveStatus('Failed to copy settings');
        }
    });
    
    importButton.addEventListener('click', () => {
        const jsonText = importText.value.trim();
        if (!jsonText) {
            updateSettingsSaveStatus('Please paste JSON settings first');
            return;
        }
        
        if (importAppSettings(jsonText)) {
            updateSettingsSaveStatus('Settings imported successfully');
            // Refresh the interface
            setTimeout(() => showSettingsManager(), 1000);
        } else {
            updateSettingsSaveStatus('Failed to import settings - invalid JSON');
        }
    });
    
    resetButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
            resetAppSettings();
            updateSettingsSaveStatus('Settings reset to defaults');
            // Refresh the interface
            setTimeout(() => showSettingsManager(), 1000);
        }
    });
}

// Update URL parameters table
function updateURLParamsTable() {
    const tbody = document.getElementById('url-params-table');
    const settings = getAppSettings();
    
    tbody.innerHTML = '';
    
    Object.entries(uriQuery.supportedParams).forEach(([name, config]) => {
        const value = settings[name];
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><code>${name}</code></td>
            <td><span class="badge badge-outline">${value !== null ? String(value) : 'null'}</span></td>
            <td><span class="badge badge-ghost">${config.type}</span></td>
            <td><span class="badge ${config.persistent ? 'badge-success' : 'badge-warning'}">${config.persistent ? 'Yes' : 'No'}</span></td>
        `;
        tbody.appendChild(row);
    });
}

// Apply theme
function applyTheme(theme) {
    const html = document.documentElement;
    if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        html.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
        html.setAttribute('data-theme', theme);
    }
}

// Apply font size
function applyFontSize(size) {
    if (terminal) {
        terminal.options.fontSize = size;
        if (fitAddon) {
            fitAddon.fit();
        }
    }
}

// Update settings save status display
function updateSettingsSaveStatus(status) {
    const saveStatus = document.getElementById('settings-save-status');
    if (saveStatus) {
        saveStatus.textContent = status;
        
        // Add visual feedback
        saveStatus.className = 'text-sm transition-colors duration-200';
        
        if (status.includes('updated') || status.includes('imported') || status.includes('exported') || status.includes('copied') || status.includes('reset')) {
            saveStatus.className += ' text-success';
        } else if (status.includes('failed') || status.includes('error')) {
            saveStatus.className += ' text-error';
        } else {
            saveStatus.className += ' opacity-70';
        }
        
        // Clear status after 3 seconds
        setTimeout(() => {
            if (saveStatus.textContent === status) {
                saveStatus.textContent = '';
            }
        }, 3000);
    }
}

// Initialize settings on page load
document.addEventListener('DOMContentLoaded', () => {
    // Apply saved theme
    const savedTheme = uriQuery.get('theme');
    if (savedTheme) {
        applyTheme(savedTheme);
    }
    
    // Apply saved font size
    const savedFontSize = uriQuery.get('fontSize');
    if (savedFontSize && terminal) {
        applyFontSize(savedFontSize);
    }
});

// Export functions for global access
window.showSettingsManager = showSettingsManager;
window.uriQuery = uriQuery;
window.getAppSettings = getAppSettings;
window.updateAppSetting = updateAppSetting;
window.updateAppSettings = updateAppSettings;
window.resetAppSettings = resetAppSettings;
window.exportAppSettings = exportAppSettings;
window.importAppSettings = importAppSettings;