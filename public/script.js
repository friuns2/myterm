// Main script file - coordinates all modules

// Initialize VirtualKeyboard API for better mobile experience
if ("virtualKeyboard" in navigator) {
    navigator.virtualKeyboard.overlaysContent = true;
    console.log('VirtualKeyboard API enabled - content will not be resized automatically');

    // Add listener for virtual keyboard geometry changes
    navigator.virtualKeyboard.ongeometrychange = () => {
        const viewportHeight = window.innerHeight;
        const keyboardTop = navigator.virtualKeyboard.boundingRect.top;
        const keyboardHeight = viewportHeight - keyboardTop;
        document.body.style.paddingBottom = `${keyboardHeight}px`;
    };
} else {
    console.log('VirtualKeyboard API not supported - using fallback CSS');
}

// Global variables shared across modules
let sessionID = getSessionIDFromURL(); // Get session ID from URL only
let currentProject = getProjectFromURL() || null;

// Check URL parameters and show appropriate interface
if (sessionID) {
    initializeTerminal();
} else {
    showSessionsAndProjectsList();
}