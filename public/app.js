// Main Petite Vue application
function AppScope() {
    return {
        currentView: 'loading', // 'loading', 'sessionList', 'terminal'
        sessions: [],
        currentSessionID: null,
        isConnected: false,
        isLoading: false,
        error: null,
        terminalManager: null,
        webSocketManager: null,
        sessionManager: null,
        uiManager: null,
        
        mounted() {
            this.initializeManagers();
            this.setupBrowserNavigation();
            this.determineInitialView();
        },
        
        initializeManagers() {
            // Initialize all manager classes
            this.terminalManager = new TerminalManager();
            this.sessionManager = new SessionManager();
            this.webSocketManager = new WebSocketManager(this.terminalManager);
            this.uiManager = new UIManager(this.terminalManager, this.webSocketManager);
            
            // Set up WebSocket callbacks
            this.webSocketManager.setSessionIDCallback((sessionID) => {
                this.currentSessionID = sessionID;
                this.sessionManager.setCurrentSessionID(sessionID);
            });
        },
        
        setupBrowserNavigation() {
            window.addEventListener('popstate', (event) => {
                const newSessionID = this.sessionManager.getSessionIDFromURL();
                if (newSessionID) {
                    this.currentSessionID = newSessionID;
                    this.showTerminal();
                } else {
                    this.currentSessionID = null;
                    this.showSessionList();
                }
            });
        },
        
        determineInitialView() {
            const sessionID = this.sessionManager.getSessionIDFromURL();
            if (sessionID) {
                this.currentSessionID = sessionID;
                this.showTerminal();
            } else {
                this.showSessionList();
            }
        },
        
        async showSessionList() {
            this.currentView = 'loading';
            this.isLoading = true;
            this.error = null;
            
            try {
                this.sessions = await this.sessionManager.getSessions();
                this.currentView = 'sessionList';
            } catch (error) {
                console.error('Failed to fetch sessions:', error);
                this.error = 'Failed to load sessions';
            } finally {
                this.isLoading = false;
            }
        },
        
        showTerminal() {
            this.currentView = 'terminal';
            setTimeout(() => {
                this.initializeTerminal();
            }, 0);
        },
        
        initializeTerminal() {
            this.terminalManager.mount('terminal');
            this.uiManager.initializeUIComponents();
            this.webSocketManager.connect(this.currentSessionID);
        },
        
        connectToSession(sessionId) {
            this.sessionManager.updateURLWithSession(sessionId);
            this.showTerminal();
        },
        
        async killSession(sessionId) {
            try {
                await this.sessionManager.killSession(sessionId);
                this.sessions = this.sessions.filter(session => session.id !== sessionId);
            } catch (error) {
                console.error('Failed to kill session:', error);
            }
        },
        
        createNewSession() {
            this.sessionManager.removeSessionFromURL();
            this.showTerminal();
        },
        
        goBackToSessionList() {
            this.webSocketManager.disconnect();
            this.sessionManager.removeSessionFromURL();
            this.currentSessionID = null;
            this.showSessionList();
        },
        
        formatDate(dateString) {
            return new Date(dateString).toLocaleString();
        }
    };
}