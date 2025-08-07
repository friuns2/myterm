// Main script file - coordinates all modules

// Initialize VirtualKeyboard API for better mobile experience
if ("virtualKeyboard" in navigator) {
    navigator.virtualKeyboard.overlaysContent = false;
    console.log('VirtualKeyboard API enabled - content will be resized automatically');
} else {
    console.log('VirtualKeyboard API not supported - using fallback CSS');
}

// Global variables shared across modules
let sessionID = null;
let currentProject = null;

// Always show sessions and projects list on startup
showSessionsAndProjectsList();