// Main script file - coordinates all modules

// Global variables shared across modules
let sessionID = getSessionIDFromURL(); // Get session ID from URL only
let currentProject = getProjectFromURL() || null;

// Check URL parameters and show appropriate interface
if (sessionID) {
    initializeTerminal();
} else {
    showSessionsAndProjectsList();
}