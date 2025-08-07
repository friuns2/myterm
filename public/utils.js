// Utility functions for the web terminal application

// Function to strip ANSI escape sequences from text
function stripAnsiCodes(text) {
    // Remove ANSI escape sequences
    return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

// Function to convert ANSI escape sequences to HTML
function ansiToHtml(text) {
    // Basic ANSI color codes mapping
    const ansiColors = {
        '30': 'color: #000000', // black
        '31': 'color: #ff0000', // red
        '32': 'color: #00ff00', // green
        '33': 'color: #ffff00', // yellow
        '34': 'color: #0000ff', // blue
        '35': 'color: #ff00ff', // magenta
        '36': 'color: #00ffff', // cyan
        '37': 'color: #ffffff', // white
        '90': 'color: #808080', // bright black (gray)
        '91': 'color: #ff8080', // bright red
        '92': 'color: #80ff80', // bright green
        '93': 'color: #ffff80', // bright yellow
        '94': 'color: #8080ff', // bright blue
        '95': 'color: #ff80ff', // bright magenta
        '96': 'color: #80ffff', // bright cyan
        '97': 'color: #ffffff'  // bright white
    };
    
    let result = text;
    let openSpans = 0;
    
    // Handle 256-color sequences like [38;2;r;g;b;m
    result = result.replace(/\x1b\[38;2;(\d+);(\d+);(\d+)m/g, (match, r, g, b) => {
        openSpans++;
        return `<span style="color: rgb(${r}, ${g}, ${b})">`;
    });
    
    // Handle basic color codes
    result = result.replace(/\x1b\[(\d+)m/g, (match, code) => {
        if (code === '0' || code === 'm') {
            // Reset - close all spans
            const closeSpans = '</span>'.repeat(openSpans);
            openSpans = 0;
            return closeSpans;
        }
        if (ansiColors[code]) {
            openSpans++;
            return `<span style="${ansiColors[code]}">`;
        }
        return ''; // Remove unhandled codes
    });
    
    // Remove any remaining ANSI sequences
    result = result.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    
    // Close any remaining open spans
    result += '</span>'.repeat(openSpans);
    
    return result;
}

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
    const state = { 
        sessionId: sessionId, 
        projectName: projectName,
        view: 'terminal'
    };
    window.history.pushState(state, '', url);
}

// Function to clear URL parameters and update history
function clearURLParams() {
    const url = new URL(window.location);
    url.searchParams.delete('session');
    url.searchParams.delete('project');
    const state = { 
        sessionId: null, 
        projectName: null,
        view: 'dashboard'
    };
    window.history.pushState(state, '', url);
}

// Alias for backward compatibility
function updateURLWithoutSession() {
    clearURLParams();
}

// Function to update URL with project only
function updateURLWithProject(projectName) {
    const url = new URL(window.location);
    url.searchParams.delete('session');
    url.searchParams.set('project', projectName);
    const state = { 
        sessionId: null, 
        projectName: projectName,
        view: 'terminal'
    };
    window.history.pushState(state, '', url);
}

// Function to validate and recover from invalid navigation states
function validateAndRecoverNavigationState() {
    const urlSessionID = getSessionIDFromURL();
    const urlProject = getProjectFromURL();
    const historyState = window.history.state;
    
    console.log('Validating navigation state:', {
        urlSessionID,
        urlProject,
        globalSessionID: sessionID,
        globalProject: currentProject,
        historyState
    });
    
    // Check for inconsistencies between URL and global state
    if (urlSessionID !== sessionID || urlProject !== currentProject) {
        console.log('Detected navigation state inconsistency, recovering...');
        
        // Update global state to match URL
        sessionID = urlSessionID;
        currentProject = urlProject;
        
        // Update history state to match
        const correctedState = {
            sessionId: sessionID,
            projectName: currentProject,
            view: sessionID ? 'terminal' : (currentProject ? 'terminal' : 'dashboard')
        };
        window.history.replaceState(correctedState, '', window.location.href);
        
        return true; // Indicates recovery was needed
    }
    
    return false; // No recovery needed
}

// Function to safely navigate with error handling
function safeNavigate(targetFunction, ...args) {
    try {
        targetFunction(...args);
    } catch (error) {
        console.error('Navigation error:', error);
        // Fallback to dashboard on navigation errors
        console.log('Falling back to dashboard due to navigation error');
        clearURLParams();
        sessionID = null;
        currentProject = null;
        showSessionsAndProjectsList();
    }
}