import { getSessionIDFromURL, getProjectFromURL, getSessionID, getCurrentProject, setSessionID, setCurrentProject, goBackToSessionList, goBackToProjectList, updateURLWithProject, updateURLWithSession } from './src/session-manager.js';
import { initializeTerminal, showSessionsAndProjectsList, showProjectList, showProjectSessions, connectToSession, killSession, createNewSessionForProject, createNewProject, selectProject, createWorktreeModal, handleWorktreeCreation, openWorktree, mergeWorktree, deleteWorktree, setupUI } from './src/ui.js';

// Expose functions to the window object for HTML inline event handlers
window.connectToSession = connectToSession;
window.killSession = killSession;
window.createNewSessionForProject = createNewSessionForProject;
window.initializeTerminal = initializeTerminal;
window.showSessionsAndProjectsList = showSessionsAndProjectsList;
window.showProjectList = showProjectList;
window.createNewProject = createNewProject;
window.selectProject = selectProject;
window.showProjectSessions = showProjectSessions;
window.goBackToSessionList = goBackToSessionList;
window.goBackToProjectList = goBackToProjectList;
window.updateURLWithProject = updateURLWithProject;
window.updateURLWithSession = updateURLWithSession;
window.createWorktreeModal = createWorktreeModal;
window.handleWorktreeCreation = handleWorktreeCreation;
window.openWorktree = openWorktree;
window.mergeWorktree = mergeWorktree;
window.deleteWorktree = deleteWorktree;


// Initial setup
let sessionID = getSessionIDFromURL();
let currentProject = getProjectFromURL();
setSessionID(sessionID);
setCurrentProject(currentProject);

// Check URL parameters and show appropriate interface
if (sessionID) {
    initializeTerminal();
} else if (currentProject) {
    showProjectSessions(currentProject);
}else {
    showSessionsAndProjectsList();
}

// Handle browser navigation (back/forward buttons)
window.addEventListener('popstate', (event) => {
    const newSessionID = getSessionIDFromURL();
    const newProject = getProjectFromURL();
    
    setSessionID(newSessionID);
    setCurrentProject(newProject);
    
    if (getSessionID()) {
        initializeTerminal();
    } else if (getCurrentProject()) {
        showProjectSessions(getCurrentProject());
    } else {
        showSessionsAndProjectsList();
    }
});

document.addEventListener('DOMContentLoaded', setupUI);