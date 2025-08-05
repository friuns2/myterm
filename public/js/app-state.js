// Application state management module
class AppState {
    constructor() {
        this.sessionID = null;
        this.currentProject = null;
        this.isTerminalVisible = false;
        this.isFileBrowserVisible = false;
        this.terminalSize = { cols: 80, rows: 24 };
        this.theme = 'dark';
        this.settings = {
            fontSize: 14,
            fontFamily: 'Courier New, monospace',
            cursorBlink: true,
            autoReconnect: true,
            maxReconnectAttempts: 10
        };
        
        // Load saved state from localStorage
        this.loadState();
    }

    // Session management
    setSession(sessionID, projectName) {
        this.sessionID = sessionID;
        this.currentProject = projectName;
        this.saveState();
        this.notifyStateChange('session', { sessionID, projectName });
    }

    clearSession() {
        this.sessionID = null;
        this.currentProject = null;
        this.saveState();
        this.notifyStateChange('session', { sessionID: null, projectName: null });
    }

    getSession() {
        return {
            sessionID: this.sessionID,
            projectName: this.currentProject
        };
    }

    // Project management
    setCurrentProject(projectName) {
        this.currentProject = projectName;
        this.saveState();
        this.notifyStateChange('project', projectName);
    }

    getCurrentProject() {
        return this.currentProject;
    }

    // Terminal state
    setTerminalVisible(visible) {
        this.isTerminalVisible = visible;
        this.notifyStateChange('terminalVisibility', visible);
    }

    isTerminalActive() {
        return this.isTerminalVisible;
    }

    setTerminalSize(cols, rows) {
        this.terminalSize = { cols, rows };
        this.notifyStateChange('terminalSize', { cols, rows });
    }

    getTerminalSize() {
        return this.terminalSize;
    }

    // File browser state
    setFileBrowserVisible(visible) {
        this.isFileBrowserVisible = visible;
        this.notifyStateChange('fileBrowserVisibility', visible);
    }

    isFileBrowserActive() {
        return this.isFileBrowserVisible;
    }

    // Settings management
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.saveState();
        this.notifyStateChange('settings', this.settings);
    }

    getSettings() {
        return { ...this.settings };
    }

    getSetting(key) {
        return this.settings[key];
    }

    setSetting(key, value) {
        this.settings[key] = value;
        this.saveState();
        this.notifyStateChange('setting', { key, value });
    }

    // Theme management
    setTheme(theme) {
        this.theme = theme;
        this.saveState();
        this.notifyStateChange('theme', theme);
        this.applyTheme();
    }

    getTheme() {
        return this.theme;
    }

    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
    }

    // State persistence
    saveState() {
        const state = {
            sessionID: this.sessionID,
            currentProject: this.currentProject,
            terminalSize: this.terminalSize,
            theme: this.theme,
            settings: this.settings
        };
        
        try {
            localStorage.setItem('myshell-state', JSON.stringify(state));
        } catch (error) {
            console.warn('Failed to save state to localStorage:', error);
        }
    }

    loadState() {
        try {
            const savedState = localStorage.getItem('myshell-state');
            if (savedState) {
                const state = JSON.parse(savedState);
                
                // Only restore non-session state on load
                this.terminalSize = state.terminalSize || this.terminalSize;
                this.theme = state.theme || this.theme;
                this.settings = { ...this.settings, ...state.settings };
                
                // Apply theme immediately
                this.applyTheme();
            }
        } catch (error) {
            console.warn('Failed to load state from localStorage:', error);
        }
    }

    clearSavedState() {
        try {
            localStorage.removeItem('myshell-state');
        } catch (error) {
            console.warn('Failed to clear saved state:', error);
        }
    }

    // State change notifications
    notifyStateChange(type, data) {
        const event = new CustomEvent('appStateChange', {
            detail: { type, data }
        });
        window.dispatchEvent(event);
    }

    // Subscribe to state changes
    onStateChange(callback) {
        window.addEventListener('appStateChange', (event) => {
            callback(event.detail.type, event.detail.data);
        });
    }

    // Utility methods
    reset() {
        this.sessionID = null;
        this.currentProject = null;
        this.isTerminalVisible = false;
        this.isFileBrowserVisible = false;
        this.terminalSize = { cols: 80, rows: 24 };
        this.saveState();
        this.notifyStateChange('reset', null);
    }

    getFullState() {
        return {
            sessionID: this.sessionID,
            currentProject: this.currentProject,
            isTerminalVisible: this.isTerminalVisible,
            isFileBrowserVisible: this.isFileBrowserVisible,
            terminalSize: this.terminalSize,
            theme: this.theme,
            settings: this.settings
        };
    }

    // Debug methods
    debugState() {
        console.log('Current App State:', this.getFullState());
    }

    // Validation methods
    isValidSession() {
        return this.sessionID && this.currentProject;
    }

    isValidProject() {
        return this.currentProject && this.currentProject.trim().length > 0;
    }

    // Navigation helpers
    canNavigateBack() {
        return this.sessionID || this.currentProject;
    }

    getNavigationContext() {
        if (this.sessionID && this.currentProject) {
            return 'terminal';
        } else if (this.currentProject) {
            return 'sessions';
        } else {
            return 'projects';
        }
    }

    // Error state management
    setError(error) {
        this.lastError = error;
        this.notifyStateChange('error', error);
    }

    clearError() {
        this.lastError = null;
        this.notifyStateChange('error', null);
    }

    getLastError() {
        return this.lastError;
    }
}

// Create global instance
window.appState = new AppState();

// Setup global state change listener for debugging
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.appState.onStateChange((type, data) => {
        console.log(`State change: ${type}`, data);
    });
}