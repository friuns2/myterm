let sessionID = null;
let currentProject = null;

export function getSessionID() {
    return sessionID;
}

export function setSessionID(id) {
    sessionID = id;
}

export function getCurrentProject() {
    return currentProject;
}

export function setCurrentProject(project) {
    currentProject = project;
}

// Function to get session ID from URL parameters
export function getSessionIDFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('session');
}

export function getProjectFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('project');
}

// Function to update URL with session ID using pushState for navigation history
export function updateURLWithSession(sessionId, projectName = null) {
    const url = new URL(window.location);
    url.searchParams.set('session', sessionId);
    if (projectName) {
        url.searchParams.set('project', projectName);
    }
    window.history.pushState({ sessionId: sessionId }, '', url);
}

export function updateURLWithProject(projectName) {
    const url = new URL(window.location);
    url.searchParams.delete('session');
    url.searchParams.set('project', projectName);
    window.history.pushState({ project: projectName }, '', url);
}

export function clearURLParams() {
    const url = new URL(window.location);
    url.searchParams.delete('session');
    url.searchParams.delete('project');
    window.history.pushState({}, '', url);
}

// Function to navigate back to session list
export function goBackToSessionList(showProjectSessions, showSessionsAndProjectsList) {
    const url = new URL(window.location);
    url.searchParams.delete('session');
    window.history.pushState({ sessionList: true }, '', url);
    if (currentProject) {
        showProjectSessions(currentProject);
    } else {
        showSessionsAndProjectsList();
    }
}

export function goBackToProjectList(showSessionsAndProjectsList) {
    clearURLParams();
    currentProject = null;
    sessionID = null;
    showSessionsAndProjectsList();
} 