// Main script file - coordinates all modules

// Initialize VirtualKeyboard API for better mobile experience
if ("virtualKeyboard" in navigator) {
    navigator.virtualKeyboard.overlaysContent = true;
    console.log('VirtualKeyboard API enabled - content will not be resized automatically');
} else {
    console.log('VirtualKeyboard API not supported - using fallback CSS');
}

// Global variables shared across modules
let sessionID = getSessionIDFromURL(); // Get session ID from URL only
let currentProject = getProjectFromURL() || null; // Project is now optional

// Check URL parameters and show appropriate interface
if (sessionID) {
    initializeTerminal(); // Initialize terminal regardless of project parameter
} else {
    showSessionsAndProjectsList();
}