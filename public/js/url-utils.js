// URL utilities module

// Function to get session ID from URL parameters
function getSessionIDFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('session');
}

function getProjectFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('project');
}

// Function to update URL with session ID using pushState for navigation history
function updateURLWithSession(sessionId, projectName = null) {
    const url = new URL(window.location);
    url.searchParams.set('session', sessionId);
    if (projectName) {
        url.searchParams.set('project', projectName);
    }
    window.history.pushState({ sessionId: sessionId }, '', url);
}

function updateURLWithProject(projectName) {
    const url = new URL(window.location);
    url.searchParams.delete('session');
    url.searchParams.set('project', projectName);
    window.history.pushState({ project: projectName }, '', url);
}

function clearURLParams() {
    const url = new URL(window.location);
    url.searchParams.delete('session');
    url.searchParams.delete('project');
    window.history.pushState({}, '', url);
}

// Function to navigate back to session list
function goBackToSessionList() {
    const url = new URL(window.location);
    url.searchParams.delete('session');
    window.history.pushState({ sessionList: true }, '', url);
    if (currentProject) {
        window.projectManager.showProjectSessions(currentProject);
    } else {
        window.projectManager.showSessionsAndProjectsList();
    }
}

function goBackToProjectList() {
    clearURLParams();
    currentProject = null;
    sessionID = null;
    window.projectManager.showSessionsAndProjectsList();
}

// Export functions for use in other modules
window.urlUtils = {
    getSessionIDFromURL,
    getProjectFromURL,
    updateURLWithSession,
    updateURLWithProject,
    clearURLParams,
    goBackToSessionList,
    goBackToProjectList
};