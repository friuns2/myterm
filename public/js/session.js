// Session management and API calls
class SessionManager {
    constructor() {
        this.currentSessionID = this.getSessionIDFromURL();
    }

    getSessionIDFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('session');
    }

    updateURLWithSession(sessionId) {
        const url = new URL(window.location);
        url.searchParams.set('session', sessionId);
        window.history.pushState({ sessionId: sessionId }, '', url);
        this.currentSessionID = sessionId;
    }

    removeSessionFromURL() {
        const url = new URL(window.location);
        url.searchParams.delete('session');
        window.history.pushState({ sessionList: true }, '', url);
        this.currentSessionID = null;
    }

    async getSessions() {
        try {
            const response = await fetch('/api/sessions');
            return await response.json();
        } catch (error) {
            console.error('Failed to load sessions:', error);
            throw error;
        }
    }

    async killSession(sessionId) {
        try {
            const response = await fetch(`/api/sessions/${sessionId}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || 'Failed to kill session');
            }
            
            return result;
        } catch (error) {
            console.error('Error killing session:', error);
            throw error;
        }
    }

    createNewSession() {
        this.removeSessionFromURL();
        return null; // Will create new session when connecting
    }

    connectToSession(sessionId) {
        this.updateURLWithSession(sessionId);
        return sessionId;
    }

    getCurrentSessionID() {
        return this.currentSessionID;
    }

    setCurrentSessionID(sessionId) {
        this.currentSessionID = sessionId;
        if (sessionId) {
            this.updateURLWithSession(sessionId);
        }
    }
}

// Export for use in other modules
window.SessionManager = SessionManager;