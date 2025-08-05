// Main application initialization and coordination
class App {
    constructor() {
        this.terminalManager = null;
        this.wsManager = null;
        this.sessionManager = null;
        this.uiManager = null;
        this.isInitialized = false;
    }

    initialize() {
        if (this.isInitialized) return;

        // Initialize all managers
        this.terminalManager = new TerminalManager();
        this.wsManager = new WebSocketManager();
        this.sessionManager = new SessionManager();
        this.uiManager = new UIManager();

        // Make managers globally available for cross-module communication
        window.terminalManager = this.terminalManager;
        window.wsManager = this.wsManager;
        window.sessionManager = this.sessionManager;
        window.uiManager = this.uiManager;

        // Initialize UI components
        this.uiManager.initialize();

        // Initialize session management (this will handle initial routing)
        this.sessionManager.initialize();

        this.isInitialized = true;
        console.log('Application initialized successfully');
    }

    // Graceful shutdown
    shutdown() {
        if (this.wsManager) {
            this.wsManager.disconnect();
        }
        console.log('Application shutdown');
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.initialize();
    
    // Make app globally available
    window.app = app;
    
    // Handle page unload
    window.addEventListener('beforeunload', () => {
        app.shutdown();
    });
});

// Export for potential module use
window.App = App;