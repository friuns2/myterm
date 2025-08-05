// Main application initialization

// Global variables (maintaining compatibility with existing code)
let term = null;
let socket = null;
let sessionID = null;
let currentProject = null;
let isFileBrowserOpen = false;

// Initialize the application
function initializeApp() {
    // Initialize all modules
    if (window.eventHandlers && window.eventHandlers.initializeEventHandlers) {
        window.eventHandlers.initializeEventHandlers();
    }
    
    // Check URL parameters to determine initial state
    const sessionId = window.urlUtils.getSessionIdFromURL();
    const projectName = window.urlUtils.getProjectFromURL();
    
    if (sessionId) {
        // Connect to existing session
        sessionID = sessionId;
        currentProject = null;
        window.terminalModule.initializeTerminal();
    } else if (projectName) {
        // Show project sessions
        window.projectManager.showProjectSessions(projectName);
    } else {
        // Show main sessions and projects list
        window.projectManager.showSessionsAndProjectsList();
    }
}

// Make global variables available to all modules
window.term = term;
window.socket = socket;
window.sessionID = sessionID;
window.currentProject = currentProject;
window.isFileBrowserOpen = isFileBrowserOpen;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Export main functions
window.app = {
    initializeApp,
    // Expose global state getters/setters
    getTerm: () => window.term,
    setTerm: (terminal) => { window.term = terminal; },
    getSocket: () => window.socket,
    setSocket: (ws) => { window.socket = ws; },
    getSessionID: () => window.sessionID,
    setSessionID: (id) => { window.sessionID = id; },
    getCurrentProject: () => window.currentProject,
    setCurrentProject: (project) => { window.currentProject = project; },
    getFileBrowserState: () => window.isFileBrowserOpen,
    setFileBrowserState: (state) => { window.isFileBrowserOpen = state; }
};