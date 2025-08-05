// Main application initialization module

// Global variables
window.sessionID = null;
window.currentProject = null;
window.currentWorktree = null;

// Initialize the application
function initializeApp() {
    // Initialize UI components
    window.UIModule.initializeUI();
    
    // Get session and project from URL
    const urlSessionID = window.URLModule.getSessionIDFromURL();
    const urlProjectName = window.URLModule.getProjectFromURL();
    
    if (urlSessionID) {
        // Connect to existing session
        window.sessionID = urlSessionID;
        window.currentProject = urlProjectName;
        window.TerminalModule.initializeTerminal();
    } else if (urlProjectName) {
        // Open project terminal
        window.currentProject = urlProjectName;
        window.TerminalModule.initializeTerminal();
    } else {
        // Show dashboard
        window.ProjectModule.showSessionsAndProjectsList();
    }
    
    // Set up navigation event listeners
    setupNavigationListeners();
}

function setupNavigationListeners() {
    // Home button
    const homeBtn = document.getElementById('home-btn');
    if (homeBtn) {
        homeBtn.addEventListener('click', () => {
            window.UIModule.goBackToSessionsList();
        });
    }
    
    // Projects button
    const projectsBtn = document.getElementById('projects-btn');
    if (projectsBtn) {
        projectsBtn.addEventListener('click', () => {
            window.ProjectModule.showProjectList();
        });
    }
    
    // Files button
    const filesBtn = document.getElementById('files-btn');
    if (filesBtn) {
        filesBtn.addEventListener('click', () => {
            window.FileModule.showFileBrowser();
        });
    }
    
    // Terminal button
    const terminalBtn = document.getElementById('terminal-btn');
    if (terminalBtn) {
        terminalBtn.addEventListener('click', () => {
            if (window.currentProject) {
                window.TerminalModule.initializeTerminal();
            } else {
                window.ProjectModule.showProjectList();
            }
        });
    }
    
    // Virtual keyboard button
    const keyboardBtn = document.getElementById('keyboard-btn');
    if (keyboardBtn) {
        keyboardBtn.addEventListener('click', () => {
            window.UIModule.toggleVirtualKeyboard();
        });
    }
}

// Handle browser back/forward navigation
window.addEventListener('popstate', (event) => {
    const urlSessionID = window.URLModule.getSessionIDFromURL();
    const urlProjectName = window.URLModule.getProjectNameFromURL();
    
    if (urlSessionID) {
        window.sessionID = urlSessionID;
        window.currentProject = urlProjectName;
        window.TerminalModule.initializeTerminal();
    } else if (urlProjectName) {
        window.currentProject = urlProjectName;
        window.TerminalModule.initializeTerminal();
    } else {
        window.sessionID = null;
        window.currentProject = null;
        window.ProjectModule.showSessionsAndProjectsList();
    }
});

// Initialize app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Export for global access
window.AppModule = {
    initializeApp,
    setupNavigationListeners
};