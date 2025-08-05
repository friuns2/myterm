// UI management module

// Function to navigate back to session list
function goBackToSessionList() {
    const url = new URL(window.location);
    url.searchParams.delete('session');
    window.history.pushState({ sessionList: true }, '', url);
    const currentProject = window.WebSocketManager.getCurrentProject();
    if (currentProject) {
        window.Projects.showProjectSessions(currentProject);
    } else {
        window.Projects.showSessionsAndProjectsList();
    }
}

function goBackToProjectList() {
    window.Utils.clearURLParams();
    window.WebSocketManager.setCurrentProject(null);
    window.WebSocketManager.setSessionID(null);
    window.Projects.showSessionsAndProjectsList();
}

// File browser and editor functions
function showNavigationBar() {
    const navBar = document.getElementById('nav-bar');
    if (navBar) {
        navBar.classList.remove('hidden');
        
        // Update current path display
        const currentPathSpan = document.getElementById('current-path');
        const currentProject = window.WebSocketManager.getCurrentProject();
        if (currentPathSpan && currentProject) {
            currentPathSpan.textContent = `Project: ${currentProject}`;
        }
    }
}

function hideNavigationBar() {
    const navBar = document.getElementById('nav-bar');
    if (navBar) {
        navBar.classList.add('hidden');
    }
}

// Function to connect to existing session
function connectToSession(sessionId, projectName = null) {
    window.WebSocketManager.setSessionID(sessionId);
    const currentProject = projectName || window.WebSocketManager.getCurrentProject();
    window.WebSocketManager.setCurrentProject(currentProject);
    window.Utils.updateURLWithSession(sessionId, currentProject);
    window.Terminal.initializeTerminal();
}

// Function to create new session for project
function createNewSessionForProject(projectName) {
    window.WebSocketManager.setSessionID(null);
    window.WebSocketManager.setCurrentProject(projectName);
    window.Utils.updateURLWithProject(projectName);
    window.Terminal.initializeTerminal();
}

// Function to kill a session
async function killSession(sessionId) {
    try {
        const response = await fetch(`/api/sessions/${sessionId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        
        if (result.success) {
            // Always go back to the dashboard after killing a session
            window.Projects.showSessionsAndProjectsList();
        } else {
            await Swal.fire({
                title: 'Error',
                text: 'Failed to kill session: ' + result.message,
                icon: 'error'
            });
        }
    } catch (error) {
        console.error('Error killing session:', error);
        await Swal.fire({
            title: 'Error',
            text: 'Error killing session',
            icon: 'error'
        });
    }
}

// Function to select project
function selectProject(projectName) {
    window.WebSocketManager.setCurrentProject(projectName);
    window.WebSocketManager.setSessionID(null);
    window.Utils.updateURLWithProject(projectName);
    window.Terminal.initializeTerminal();
}

// Export UI functions
window.UI = {
    goBackToSessionList,
    goBackToProjectList,
    showNavigationBar,
    hideNavigationBar,
    connectToSession,
    createNewSessionForProject,
    killSession,
    selectProject
};