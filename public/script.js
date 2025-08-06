// Main script file - coordinates all modules

// Initialize VirtualKeyboard API for better mobile experience
if ("virtualKeyboard" in navigator) {
    navigator.virtualKeyboard.overlaysContent = true;
    console.log('VirtualKeyboard API enabled - content will not be resized automatically');
} else {
    console.log('VirtualKeyboard API not supported - using fallback CSS');
}

// Mobile keyboard handling
function setupMobileKeyboardHandling() {
    const customInput = document.getElementById('custom-command-input');
    const virtualKeyboard = document.getElementById('virtual-keyboard');
    
    if (customInput && virtualKeyboard) {
        // Handle focus events to ensure input is visible
        customInput.addEventListener('focus', () => {
            // Small delay to ensure keyboard is shown
            setTimeout(() => {
                // Scroll the input into view
                customInput.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center',
                    inline: 'nearest'
                });
                
                // Adjust terminal container height
                const terminalContainer = document.getElementById('terminal-container');
                if (terminalContainer && window.innerWidth <= 768) {
                    terminalContainer.style.maxHeight = 'calc(100vh - 250px)';
                }
            }, 300);
        });
        
        customInput.addEventListener('blur', () => {
            // Reset terminal container height when keyboard is hidden
            const terminalContainer = document.getElementById('terminal-container');
            if (terminalContainer && window.innerWidth <= 768) {
                terminalContainer.style.maxHeight = 'calc(100vh - 200px)';
            }
        });
    }
    
    // Handle viewport changes for better mobile experience
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            const keyboardHeight = window.innerHeight - window.visualViewport.height;
            const terminalContainer = document.getElementById('terminal-container');
            
            if (keyboardHeight > 0 && terminalContainer && window.innerWidth <= 768) {
                // Keyboard is visible, adjust layout
                terminalContainer.style.maxHeight = `calc(100vh - ${keyboardHeight + 150}px)`;
                
                // Ensure virtual keyboard stays above the system keyboard
                if (virtualKeyboard) {
                    virtualKeyboard.style.bottom = `${keyboardHeight}px`;
                }
            } else if (terminalContainer && window.innerWidth <= 768) {
                // Keyboard is hidden, reset layout
                terminalContainer.style.maxHeight = 'calc(100vh - 200px)';
                
                if (virtualKeyboard) {
                    virtualKeyboard.style.bottom = '0px';
                }
            }
        });
    }
}

// Initialize mobile keyboard handling after DOM is loaded
document.addEventListener('DOMContentLoaded', setupMobileKeyboardHandling);

// Global variables shared across modules
let sessionID = getSessionIDFromURL(); // Get session ID from URL only
let currentProject = getProjectFromURL() || null;

// Check URL parameters and show appropriate interface
if (sessionID) {
    initializeTerminal();
} else {
    showSessionsAndProjectsList();
}