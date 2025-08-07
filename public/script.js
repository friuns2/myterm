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
let currentProject = getProjectFromURL() || null;

// Handle page refresh and initial load
function handleInitialPageLoad() {
    console.log('Initial page load - sessionID:', sessionID, 'currentProject:', currentProject);
    
    // Set initial history state if none exists
    if (!window.history.state) {
        const initialState = {
            sessionId: sessionID,
            projectName: currentProject,
            view: sessionID ? 'terminal' : (currentProject ? 'terminal' : 'dashboard')
        };
        window.history.replaceState(initialState, '', window.location.href);
        console.log('Set initial history state:', initialState);
    }
    
    // Check URL parameters and show appropriate interface
    if (sessionID) {
        console.log('Loading terminal for session:', sessionID);
        initializeTerminal();
    } else if (currentProject) {
        console.log('Loading terminal for project:', currentProject);
        initializeTerminal();
    } else {
        console.log('Loading dashboard');
        showSessionsAndProjectsList();
    }
}

// Handle page visibility changes to reconnect if needed
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        console.log('Page became visible, validating state...');
        
        // Validate navigation state when page becomes visible
        validateAndRecoverNavigationState();
        
        // Check WebSocket connection if we have a session
        if (sessionID && typeof connectWebSocket === 'function') {
            console.log('Checking WebSocket connection...');
            // Small delay to allow any existing connections to settle
            setTimeout(() => {
                if (!isConnected) {
                    console.log('Reconnecting due to page visibility change');
                    connectWebSocket();
                }
            }, 100);
        }
    }
});

// Periodic validation to catch any state drift
setInterval(() => {
    if (document.visibilityState === 'visible') {
        validateAndRecoverNavigationState();
    }
}, 30000); // Check every 30 seconds when page is visible

// Initialize the application
handleInitialPageLoad();