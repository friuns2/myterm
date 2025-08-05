// Main application module

// Function to initialize the application
function initializeApp() {
    // Check URL parameters to determine what to show
    const sessionID = window.Utils.getSessionIDFromURL();
    const projectName = window.Utils.getProjectFromURL();
    
    if (sessionID) {
        // Connect to existing session
        window.WebSocketManager.setSessionID(sessionID);
        if (projectName) {
            window.WebSocketManager.setCurrentProject(projectName);
        }
        window.Terminal.initializeTerminal();
    } else if (projectName) {
        // Open project (create new session)
        window.WebSocketManager.setCurrentProject(projectName);
        window.Terminal.initializeTerminal();
    } else {
        // Show sessions and projects list
        window.Projects.showSessionsAndProjectsList();
    }
}

// Function to setup global event listeners
function setupEventListeners() {
    // Handle browser back/forward navigation
    window.addEventListener('popstate', (event) => {
        if (event.state) {
            if (event.state.sessionList) {
                const currentProject = window.WebSocketManager.getCurrentProject();
                if (currentProject) {
                    window.Projects.showProjectSessions(currentProject);
                } else {
                    window.Projects.showSessionsAndProjectsList();
                }
            } else if (event.state.project) {
                window.Projects.showProjectSessions(event.state.project);
            }
        } else {
            // No state, reinitialize based on URL
            initializeApp();
        }
    });
    
    // Handle window resize
    window.addEventListener('resize', () => {
        window.Terminal.handleResize();
    });
    
    // Handle visibility change (focus terminal when tab becomes visible)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            const terminal = window.Terminal.getTerminal();
            if (terminal) {
                terminal.focus();
            }
        }
    });
    
    // Handle general clicks to focus terminal
    document.addEventListener('click', (e) => {
        // Don't focus terminal if clicking on UI elements
        if (!e.target.closest('.bg-gray-800') && 
            !e.target.closest('#file-browser') && 
            !e.target.closest('#file-editor') &&
            !e.target.closest('#virtual-keyboard') &&
            !e.target.closest('#nav-bar')) {
            const terminal = window.Terminal.getTerminal();
            if (terminal) {
                terminal.focus();
            }
        }
    });
}

// Function to setup UI event listeners
function setupUIEventListeners() {
    // Back to sessions button
    const backToSessionsBtn = document.getElementById('back-to-sessions');
    if (backToSessionsBtn) {
        backToSessionsBtn.addEventListener('click', window.UI.goBackToSessionList);
    }
    
    // File browser toggle button
    const fileBrowserBtn = document.getElementById('file-browser-btn');
    if (fileBrowserBtn) {
        fileBrowserBtn.addEventListener('click', window.FileBrowser.toggleFileBrowser);
    }
    
    // File browser close button
    const closeBrowserBtn = document.getElementById('close-browser');
    if (closeBrowserBtn) {
        closeBrowserBtn.addEventListener('click', window.FileBrowser.closeFileBrowser);
    }
    
    // File editor close button
    const closeEditorBtn = document.getElementById('close-editor');
    if (closeEditorBtn) {
        closeEditorBtn.addEventListener('click', window.FileBrowser.closeFileEditor);
    }
    
    // New file button
    const newFileBtn = document.getElementById('new-file-btn');
    if (newFileBtn) {
        newFileBtn.addEventListener('click', window.FileBrowser.createNewFile);
    }
    
    // New folder button
    const newFolderBtn = document.getElementById('new-folder-btn');
    if (newFolderBtn) {
        newFolderBtn.addEventListener('click', window.FileBrowser.createNewFolder);
    }
    
    // Virtual keyboard toggle button
    const keyboardBtn = document.getElementById('keyboard-btn');
    if (keyboardBtn) {
        keyboardBtn.addEventListener('click', window.Keyboard.toggleVirtualKeyboard);
    }
    
    // Custom command send button
    const sendCommandBtn = document.getElementById('send-command-btn');
    if (sendCommandBtn) {
        sendCommandBtn.addEventListener('click', window.Keyboard.handleCustomCommand);
    }
    
    // Setup keyboard event listeners
    window.Keyboard.setupKeyboardEventListeners();
}

// Function to setup modal event listeners
function setupModalEventListeners() {
    // Close modals when clicking outside
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('fixed') && e.target.classList.contains('inset-0')) {
            e.target.remove();
        }
    });
    
    // Close modals with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.querySelector('.fixed.inset-0');
            if (modal) {
                modal.remove();
            }
        }
    });
}

// Main DOMContentLoaded event handler
document.addEventListener('DOMContentLoaded', () => {
    // Setup all event listeners
    setupEventListeners();
    setupUIEventListeners();
    setupModalEventListeners();
    
    // Initialize the application
    initializeApp();
});

// Export app functions
window.App = {
    initializeApp,
    setupEventListeners,
    setupUIEventListeners,
    setupModalEventListeners
};