// Session management module
export class SessionManager {
    constructor() {
        this.sessions = [];
    }

    async fetchSessions() {
        try {
            const response = await fetch('/api/sessions');
            if (response.ok) {
                this.sessions = await response.json();
                return this.sessions;
            } else {
                console.error('Failed to fetch sessions');
                return [];
            }
        } catch (error) {
            console.error('Error fetching sessions:', error);
            return [];
        }
    }

    async killSession(sessionId) {
        try {
            const response = await fetch(`/api/sessions/${sessionId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Session killed:', result.message);
                return true;
            } else {
                console.error('Failed to kill session');
                return false;
            }
        } catch (error) {
            console.error('Error killing session:', error);
            return false;
        }
    }

    getSessionIDFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('session');
    }

    updateURLWithSession(sessionId) {
        const url = new URL(window.location);
        url.searchParams.set('session', sessionId);
        window.history.pushState({ sessionId: sessionId }, '', url);
    }

    navigateToSessionList() {
        const url = new URL(window.location);
        url.searchParams.delete('session');
        window.history.pushState({}, '', url);
    }

    generateSessionId() {
        return 'session_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }
}