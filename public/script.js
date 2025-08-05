// Main script file - loads all modules and initializes the application

// This file serves as the entry point and module loader for the application
// All functionality has been split into separate modules for better organization

// The modules are loaded via script tags in the HTML file in this order:
// 1. terminal.js - Terminal management
// 2. websocket.js - WebSocket communication
// 3. url-utils.js - URL parameter handling
// 4. project-manager.js - Project and session management
// 5. file-operations.js - File browsing and editing
// 6. worktree-manager.js - Git worktree operations
// 7. ui-utils.js - UI utilities and virtual keyboard
// 8. app.js - Main application initialization
// 9. script.js - This file (legacy compatibility)

// Legacy compatibility - expose some functions globally for existing HTML onclick handlers
window.showSessionsAndProjectsList = () => window.ProjectModule.showSessionsAndProjectsList();
window.showProjectList = () => window.ProjectModule.showProjectList();
window.createNewProject = () => window.ProjectModule.createNewProject();
window.selectProject = (projectName) => window.ProjectModule.selectProject(projectName);
window.showProjectSessions = (projectName) => window.ProjectModule.showProjectSessions(projectName);
window.connectToSession = (sessionId, projectName) => window.ProjectModule.connectToSession(sessionId, projectName);
window.killSession = (sessionId) => window.ProjectModule.killSession(sessionId);
window.createNewSessionForProject = (projectName) => window.ProjectModule.createNewSessionForProject(projectName);

window.createWorktreeModal = (projectName) => window.WorktreeModule.createWorktreeModal(projectName);
window.openWorktree = (projectName, worktreeName) => window.WorktreeModule.openWorktree(projectName, worktreeName);
window.mergeWorktree = (projectName, worktreeName) => window.WorktreeModule.mergeWorktree(projectName, worktreeName);
window.deleteWorktree = (projectName, worktreeName) => window.WorktreeModule.deleteWorktree(projectName, worktreeName);

window.goBackToProjectList = () => window.UIModule.goBackToProjectList();
window.goBackToSessionsList = () => window.UIModule.goBackToSessionsList();

// Initialize the application if modules are loaded
if (typeof window.AppModule !== 'undefined') {
    // App module handles initialization
    console.log('All modules loaded, app initialization handled by AppModule');
} else {
    // Fallback initialization if modules aren't loaded yet
    console.log('Modules not yet loaded, waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', () => {
        // Check again after DOM is loaded
        if (typeof window.AppModule !== 'undefined') {
            window.AppModule.initializeApp();
        } else {
            console.error('AppModule not found - ensure all module scripts are loaded');
        }
    });
}