// Main Vue.js application using Vue Petite
import { TerminalManager } from './js/terminal.js';
import { SessionManager } from './js/sessionManager.js';
import { VirtualKeyboard } from './js/virtualKeyboard.js';

// Create the main Vue application
function createTerminalApp() {
    return {
        // Reactive data
        sessions: [],
        currentSessionId: null,
        showSessionList: false,
        isLoading: false,
        
        // Managers
        terminalManager: null,
        sessionManager: null,
        virtualKeyboard: null,

        // Computed properties
        get hasActiveSessions() {
            return this.sessions.length > 0;
        },
        
        // Initialize the application
        async init() {
            this.terminalManager = new TerminalManager();
            this.sessionManager = new SessionManager();
            this.virtualKeyboard = new VirtualKeyboard(this.terminalManager);
            
            // Get session ID from URL
            this.currentSessionId = this.sessionManager.getSessionIDFromURL();
            
            // Setup browser navigation
            this.setupNavigation();
            
            if (!this.currentSessionId) {
                await this.displaySessionList();
            } else {
                this.initializeTerminalSession();
            }
        },
        
        // Initialize terminal for a specific session
        initializeTerminalSession() {
            this.showSessionList = false;
            this.terminalManager.initialize();
            this.virtualKeyboard.initialize();
            this.terminalManager.connectWebSocket(this.currentSessionId);
        },
        
        // Display session list
        async displaySessionList() {
            this.showSessionList = true;
            this.isLoading = true;
            
            try {
                this.sessions = await this.sessionManager.fetchSessions();
            } catch (error) {
                console.error('Error loading sessions:', error);
            } finally {
                this.isLoading = false;
            }
        },
        
        // Connect to an existing session
        connectToSession(sessionId) {
            this.currentSessionId = sessionId;
            this.sessionManager.updateURLWithSession(sessionId);
            this.initializeTerminalSession();
        },
        
        // Create a new session
        createNewSession() {
            const newSessionId = this.sessionManager.generateSessionId();
            this.connectToSession(newSessionId);
        },
        
        // Kill a session
        async killSession(sessionId) {
            this.isLoading = true;
            
            try {
                const success = await this.sessionManager.killSession(sessionId);
                if (success) {
                    // Refresh session list
                    this.sessions = await this.sessionManager.fetchSessions();
                    
                    // If we killed the current session, go back to session list
                    if (sessionId === this.currentSessionId) {
                        this.goBackToSessionList();
                    }
                }
            } catch (error) {
                console.error('Error killing session:', error);
            } finally {
                this.isLoading = false;
            }
        },
        
        // Navigate back to session list
        goBackToSessionList() {
            this.currentSessionId = null;
            this.sessionManager.navigateToSessionList();
            this.displaySessionList();
        },
        
        // Setup browser navigation handling
        setupNavigation() {
            window.addEventListener('popstate', (event) => {
                const sessionId = this.sessionManager.getSessionIDFromURL();
                if (sessionId !== this.currentSessionId) {
                    this.currentSessionId = sessionId;
                    if (sessionId) {
                        this.initializeTerminalSession();
                    } else {
                        this.displaySessionList();
                    }
                }
            });
        },
        
        // Format date for display
        formatDate(dateString) {
            return new Date(dateString).toLocaleString();
        },
        
        // Vue lifecycle - called when component is mounted
        mounted() {
            this.init();
        }
    };
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const { createApp } = window.PetiteVue;
    const app = createApp(createTerminalApp());
    app.mount('#app');
});