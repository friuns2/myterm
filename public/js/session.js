// Session management and navigation
class SessionManager {
    constructor() {
        this.currentSessionID = null;
    }

    // Function to get session ID from URL parameters
    getSessionIDFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('session');
    }

    // Function to update URL with session ID
    updateURLWithSession(sessionId) {
        const url = new URL(window.location);
        url.searchParams.set('session', sessionId);
        window.history.pushState({ sessionId }, '', url);
        this.currentSessionID = sessionId;
    }

    // Show session list
    async showSessionList() {
        try {
            const response = await fetch('/api/sessions');
            const sessions = await response.json();
            
            const sessionListContainer = document.getElementById('session-list');
            const terminalContainer = document.getElementById('terminal-container');
            
            if (sessionListContainer && terminalContainer) {
                sessionListContainer.style.display = 'block';
                terminalContainer.style.display = 'none';
                
                const sessionList = document.getElementById('sessions');
                if (sessionList) {
                    sessionList.innerHTML = '';
                    
                    sessions.forEach(session => {
                        const sessionItem = document.createElement('div');
                        sessionItem.className = 'session-item';
                        sessionItem.innerHTML = `
                            <div class="session-info">
                                <div class="session-id">${session.id}</div>
                                <div class="session-status">${session.status}</div>
                            </div>
                            <button onclick="window.sessionManager.connectToSession('${session.id}')">Connect</button>
                        `;
                        sessionList.appendChild(sessionItem);
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching sessions:', error);
        }
    }

    // Connect to existing session
    connectToSession(sessionId) {
        this.currentSessionID = sessionId;
        this.updateURLWithSession(sessionId);
        this.initializeTerminal();
    }

    // Create new session
    createNewSession() {
        // Clear session ID to create new session
        this.currentSessionID = null;
        const url = new URL(window.location);
        url.searchParams.delete('session');
        window.history.pushState({}, '', url);
        this.initializeTerminal();
    }

    // Initialize terminal for current session
    initializeTerminal() {
        const sessionListContainer = document.getElementById('session-list');
        const terminalContainer = document.getElementById('terminal-container');
        
        if (sessionListContainer && terminalContainer) {
            sessionListContainer.style.display = 'none';
            terminalContainer.style.display = 'block';
        }
        
        // Initialize terminal if not already done
        if (window.terminalManager) {
            window.terminalManager.initialize();
            window.terminalManager.focus();
        }
        
        // Connect WebSocket
        if (window.wsManager) {
            window.wsManager.connect(this.currentSessionID);
        }
    }

    // Go back to session list
    goBackToSessionList() {
        // Disconnect current WebSocket
        if (window.wsManager) {
            window.wsManager.disconnect();
        }
        
        // Update URL to remove session parameter
        const url = new URL(window.location);
        url.searchParams.delete('session');
        window.history.pushState({ sessionList: true }, '', url);
        
        this.showSessionList();
    }

    // Handle browser navigation
    handlePopState(event) {
        if (event.state) {
            if (event.state.sessionList) {
                this.showSessionList();
            } else if (event.state.sessionId) {
                this.connectToSession(event.state.sessionId);
            }
        } else {
            // Handle direct URL access
            const sessionID = this.getSessionIDFromURL();
            if (sessionID) {
                this.connectToSession(sessionID);
            } else {
                this.showSessionList();
            }
        }
    }

    // Initialize session management
    initialize() {
        // Set up browser navigation handling
        window.addEventListener('popstate', (event) => {
            this.handlePopState(event);
        });

        // Initialize based on current URL
        const sessionID = this.getSessionIDFromURL();
        if (!sessionID) {
            this.showSessionList();
            window.history.replaceState({ sessionList: true }, '', window.location);
        } else {
            this.initializeTerminal();
            window.history.replaceState({ sessionId: sessionID }, '', window.location);
            this.currentSessionID = sessionID;
        }
    }

    getCurrentSessionID() {
        return this.currentSessionID;
    }
}

// Export for global use
window.SessionManager = SessionManager;