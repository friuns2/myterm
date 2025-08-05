// URL utilities module

function getSessionIDFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('session');
}

function getProjectFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('project');
}

function updateURLWithSession(sessionId, projectName = null) {
    const url = new URL(window.location);
    url.searchParams.set('session', sessionId);
    if (projectName) {
        url.searchParams.set('project', projectName);
    }
    window.history.pushState({}, '', url);
}

function updateURLWithProject(projectName) {
    const url = new URL(window.location);
    url.searchParams.set('project', projectName);
    url.searchParams.delete('session'); // Remove session when switching projects
    window.history.pushState({}, '', url);
}

function clearURLParams() {
    const url = new URL(window.location);
    url.search = '';
    window.history.pushState({}, '', url);
}

function goBackToSessionList() {
    if (window.currentProject) {
        window.URLModule.updateURLWithProject(window.currentProject);
        window.ProjectModule.showProjectSessions(window.currentProject);
    } else {
        window.URLModule.clearURLParams();
        window.sessionID = null;
        window.currentProject = null;
        window.ProjectModule.showSessionsAndProjectsList();
    }
}

function goBackToProjectList() {
    window.URLModule.clearURLParams();
    window.sessionID = null;
    window.currentProject = null;
    window.ProjectModule.showSessionsAndProjectsList();
}

// Export functions for use in other modules
window.URLModule = {
    getSessionIDFromURL,
    getProjectFromURL,
    updateURLWithSession,
    updateURLWithProject,
    clearURLParams,
    goBackToSessionList,
    goBackToProjectList
};