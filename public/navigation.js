// Navigation and URL handling module

import { getURLParameter, updateURLParameters } from './utils.js';
import { getSessionID, getCurrentProject, setCurrentProject } from './websocket.js';
import { showSessionsAndProjectsList, showProjectSessions } from './sessions.js';

/**
 * Show navigation bar
 */
export function showNavigationBar() {
    const navBar = document.getElementById('nav-bar');
    if (navBar) {
        navBar.classList.remove('hidden');
        
        // Update current path display
        updateCurrentPathDisplay();
    }
}

/**
 * Hide navigation bar
 */
export function hideNavigationBar() {
    const navBar = document.getElementById('nav-bar');
    if (navBar) {
        navBar.classList.add('hidden');
    }
}

/**
 * Update current path display in navigation bar
 */
function updateCurrentPathDisplay() {
    const currentPathSpan = document.getElementById('current-path');
    const currentProject = getCurrentProject();
    
    if (currentPathSpan && currentProject) {
        currentPathSpan.textContent = `Project: ${currentProject}`;
    }
}

/**
 * Navigate back to session list
 */
export function goBackToSessionList() {
    const currentProject = getCurrentProject();
    
    if (currentProject) {
        showProjectSessions(currentProject);
    } else {
        showSessionsAndProjectsList();
    }
    
    hideNavigationBar();
}

/**
 * Navigate back to project list
 */
export function goBackToProjectList() {
    updateURLParameters(null);
    setCurrentProject(null);
    showSessionsAndProjectsList();
    hideNavigationBar();
}

/**
 * Handle browser navigation (back/forward buttons)
 */
export function setupBrowserNavigation() {
    window.addEventListener('popstate', (event) => {
        const newSessionID = getURLParameter('session');
        const newProject = getURLParameter('project');
        
        // Update WebSocket state
        import('./websocket.js').then(websocket => {
            if (newProject) {
                websocket.setCurrentProject(newProject);
            }
        });
        
        if (newSessionID) {
            // Import and initialize terminal here to avoid circular dependency
            import('./main.js').then(main => {
                main.initializeTerminal();
            });
        } else if (newProject) {
            showProjectSessions(newProject);
        } else {
            showSessionsAndProjectsList();
        }
    });
}

/**
 * Initialize navigation based on URL parameters
 */
export function initializeNavigation() {
    const sessionID = getURLParameter('session');
    const projectName = getURLParameter('project');
    
    if (sessionID) {
        // Initialize terminal for existing session
        import('./main.js').then(main => {
            main.initializeTerminal();
        });
    } else if (projectName) {
        // Show project sessions
        setCurrentProject(projectName);
        showProjectSessions(projectName);
    } else {
        // Show main dashboard
        showSessionsAndProjectsList();
    }
}

/**
 * Setup navigation event listeners
 */
export function setupNavigationListeners() {
    // Navigation bar event listeners
    const backToSessionsBtn = document.getElementById('back-to-sessions');
    if (backToSessionsBtn) {
        backToSessionsBtn.addEventListener('click', () => {
            const currentProject = getCurrentProject();
            if (currentProject) {
                goBackToProjectList();
            } else {
                goBackToSessionList();
            }
        });
    }
    
    const browseFilesBtn = document.getElementById('browse-files');
    if (browseFilesBtn) {
        browseFilesBtn.addEventListener('click', () => {
            import('./fileBrowser.js').then(fileBrowser => {
                fileBrowser.toggleFileBrowser();
            });
        });
    }
} 