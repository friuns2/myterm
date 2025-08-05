// URL management module
class URLManager {
    constructor() {
        this.setupPopstateHandler();
    }

    // Get session ID from URL
    getSessionFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('session');
    }

    // Get project name from URL
    getProjectFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('project');
    }

    // Update URL with session and project information
    updateURLWithSession(sessionID, projectName) {
        const url = new URL(window.location);
        if (sessionID) {
            url.searchParams.set('session', sessionID);
        } else {
            url.searchParams.delete('session');
        }
        if (projectName) {
            url.searchParams.set('project', projectName);
        } else {
            url.searchParams.delete('project');
        }
        window.history.pushState({}, '', url);
    }

    // Clear session from URL
    clearSessionFromURL() {
        const url = new URL(window.location);
        url.searchParams.delete('session');
        url.searchParams.delete('project');
        window.history.pushState({}, '', url);
    }

    // Navigate to project list
    navigateToProjectList() {
        this.clearSessionFromURL();
        window.appState.sessionID = null;
        window.appState.currentProject = null;
        window.uiManager.showProjectList();
    }

    // Navigate to session list for a project
    navigateToSessionList(projectName) {
        const url = new URL(window.location);
        url.searchParams.delete('session');
        if (projectName) {
            url.searchParams.set('project', projectName);
        }
        window.history.pushState({}, '', url);
        
        window.appState.sessionID = null;
        window.appState.currentProject = projectName;
        window.uiManager.showSessionList(projectName);
    }

    // Navigate to terminal with session
    navigateToTerminal(sessionID, projectName) {
        this.updateURLWithSession(sessionID, projectName);
        window.appState.sessionID = sessionID;
        window.appState.currentProject = projectName;
        window.terminalManager.initializeTerminal();
    }

    // Setup browser navigation handler
    setupPopstateHandler() {
        window.addEventListener('popstate', (event) => {
            this.handleBrowserNavigation();
        });
    }

    // Handle browser back/forward navigation
    handleBrowserNavigation() {
        const sessionID = this.getSessionFromURL();
        const projectName = this.getProjectFromURL();
        
        if (sessionID && projectName) {
            // Navigate to terminal
            window.appState.sessionID = sessionID;
            window.appState.currentProject = projectName;
            window.terminalManager.initializeTerminal();
        } else if (projectName) {
            // Navigate to session list
            window.appState.sessionID = null;
            window.appState.currentProject = projectName;
            window.uiManager.showSessionList(projectName);
        } else {
            // Navigate to project list
            window.appState.sessionID = null;
            window.appState.currentProject = null;
            window.uiManager.showProjectList();
        }
    }

    // Initialize based on current URL
    initializeFromURL() {
        const sessionID = this.getSessionFromURL();
        const projectName = this.getProjectFromURL();
        
        if (sessionID && projectName) {
            window.appState.sessionID = sessionID;
            window.appState.currentProject = projectName;
            window.terminalManager.initializeTerminal();
        } else if (projectName) {
            window.appState.currentProject = projectName;
            window.uiManager.showSessionList(projectName);
        } else {
            window.uiManager.showProjectList();
        }
    }

    // Get current URL parameters as object
    getCurrentParams() {
        const params = {};
        const urlParams = new URLSearchParams(window.location.search);
        for (const [key, value] of urlParams) {
            params[key] = value;
        }
        return params;
    }

    // Set multiple URL parameters
    setParams(params) {
        const url = new URL(window.location);
        for (const [key, value] of Object.entries(params)) {
            if (value !== null && value !== undefined) {
                url.searchParams.set(key, value);
            } else {
                url.searchParams.delete(key);
            }
        }
        window.history.pushState({}, '', url);
    }
}

// Create global instance
window.urlManager = new URLManager();