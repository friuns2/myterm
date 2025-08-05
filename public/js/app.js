// Main application module
class App {
    constructor() {
        this.initialized = false;
        this.modules = {};
    }

    // Initialize the application
    async init() {
        if (this.initialized) {
            console.warn('App already initialized');
            return;
        }

        try {
            console.log('Initializing MyShell application...');
            
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }

            // Initialize modules
            this.initializeModules();
            
            // Setup global event listeners
            this.setupGlobalEvents();
            
            // Initialize based on URL
            window.urlManager.initializeFromURL();
            
            // Setup resize handler
            this.setupResizeHandler();
            
            // Setup keyboard shortcuts
            this.setupKeyboardShortcuts();
            
            // Setup state change listeners
            this.setupStateListeners();
            
            this.initialized = true;
            console.log('MyShell application initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.handleInitializationError(error);
        }
    }

    // Initialize all modules
    initializeModules() {
        // Modules are already initialized as global instances
        this.modules = {
            appState: window.appState,
            terminalManager: window.terminalManager,
            wsManager: window.wsManager,
            urlManager: window.urlManager,
            uiManager: window.uiManager,
            fileBrowser: window.fileBrowser,
            apiClient: window.apiClient
        };
        
        console.log('Modules initialized:', Object.keys(this.modules));
    }

    // Setup global event listeners
    setupGlobalEvents() {
        // Handle window beforeunload
        window.addEventListener('beforeunload', (event) => {
            if (window.wsManager.isConnected()) {
                // Don't prevent unload, just close connection gracefully
                window.wsManager.close();
            }
        });

        // Handle visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('App hidden');
            } else {
                console.log('App visible');
                // Refresh terminal if connected
                if (window.wsManager.isConnected() && window.terminalManager.getTerminal()) {
                    window.terminalManager.resize();
                }
            }
        });

        // Handle online/offline events
        window.addEventListener('online', () => {
            console.log('Connection restored');
            if (window.appState.sessionID && !window.wsManager.isConnected()) {
                window.wsManager.connect();
            }
        });

        window.addEventListener('offline', () => {
            console.log('Connection lost');
        });

        // Handle focus events
        window.addEventListener('focus', () => {
            if (window.terminalManager.getTerminal()) {
                window.terminalManager.focus();
            }
        });
    }

    // Setup resize handler
    setupResizeHandler() {
        const resizeHandler = window.Utils.debounce(() => {
            if (window.terminalManager.getTerminal()) {
                window.terminalManager.resize();
            }
        }, 100);

        window.addEventListener('resize', resizeHandler);
    }

    // Setup keyboard shortcuts
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            const { ctrlKey, metaKey, key, altKey } = event;
            const isModifier = ctrlKey || metaKey;

            // Ctrl/Cmd + B: Toggle file browser
            if (isModifier && key === 'b') {
                event.preventDefault();
                if (window.appState.currentProject) {
                    if (window.fileBrowser.isOpen()) {
                        window.fileBrowser.hide();
                    } else {
                        window.fileBrowser.show(window.appState.currentProject);
                    }
                }
            }

            // Ctrl/Cmd + `: Focus terminal
            if (isModifier && key === '`') {
                event.preventDefault();
                if (window.terminalManager.getTerminal()) {
                    window.terminalManager.focus();
                }
            }

            // Ctrl/Cmd + Shift + P: Go to projects
            if (isModifier && event.shiftKey && key === 'P') {
                event.preventDefault();
                window.urlManager.navigateToProjectList();
            }

            // Ctrl/Cmd + Shift + S: Go to sessions
            if (isModifier && event.shiftKey && key === 'S') {
                event.preventDefault();
                if (window.appState.currentProject) {
                    window.urlManager.navigateToSessionList(window.appState.currentProject);
                }
            }

            // Escape: Close modals/browsers
            if (key === 'Escape') {
                if (window.fileBrowser.isOpen()) {
                    window.fileBrowser.hide();
                } else {
                    const modal = document.getElementById('modal');
                    if (modal) {
                        window.uiManager.hideModal();
                    }
                }
            }

            // F11: Toggle fullscreen (let browser handle it)
            if (key === 'F11') {
                // Don't prevent default, let browser handle fullscreen
            }
        });
    }

    // Setup state change listeners
    setupStateListeners() {
        window.appState.onStateChange((type, data) => {
            switch (type) {
                case 'session':
                    this.handleSessionChange(data);
                    break;
                case 'project':
                    this.handleProjectChange(data);
                    break;
                case 'terminalSize':
                    this.handleTerminalSizeChange(data);
                    break;
                case 'settings':
                    this.handleSettingsChange(data);
                    break;
                case 'theme':
                    this.handleThemeChange(data);
                    break;
                case 'error':
                    this.handleError(data);
                    break;
            }
        });
    }

    // Handle session changes
    handleSessionChange(data) {
        const { sessionID, projectName } = data;
        if (sessionID && projectName) {
            console.log(`Session changed: ${sessionID} in ${projectName}`);
        } else {
            console.log('Session cleared');
        }
    }

    // Handle project changes
    handleProjectChange(projectName) {
        console.log(`Project changed: ${projectName}`);
    }

    // Handle terminal size changes
    handleTerminalSizeChange(size) {
        console.log(`Terminal size changed: ${size.cols}x${size.rows}`);
    }

    // Handle settings changes
    handleSettingsChange(settings) {
        console.log('Settings changed:', settings);
        // Apply settings to terminal if needed
        if (window.terminalManager.getTerminal()) {
            // Could update terminal settings here
        }
    }

    // Handle theme changes
    handleThemeChange(theme) {
        console.log(`Theme changed: ${theme}`);
    }

    // Handle errors
    handleError(error) {
        if (error) {
            console.error('App error:', error);
            window.uiManager.showError(error.message || 'An error occurred');
        }
    }

    // Handle initialization errors
    handleInitializationError(error) {
        const container = document.getElementById('terminal-container');
        if (container) {
            container.innerHTML = `
                <div class="flex items-center justify-center h-full">
                    <div class="text-center">
                        <h1 class="text-2xl font-bold text-red-400 mb-4">Initialization Error</h1>
                        <p class="text-gray-400 mb-4">Failed to initialize the application.</p>
                        <p class="text-sm text-gray-500">${error.message}</p>
                        <button onclick="location.reload()" class="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">
                            Reload Page
                        </button>
                    </div>
                </div>
            `;
        }
    }

    // Utility methods
    getModule(name) {
        return this.modules[name];
    }

    isInitialized() {
        return this.initialized;
    }

    // Restart the application
    async restart() {
        console.log('Restarting application...');
        
        // Close connections
        if (window.wsManager) {
            window.wsManager.close();
        }
        
        // Hide UI elements
        if (window.fileBrowser) {
            window.fileBrowser.hide();
        }
        
        if (window.uiManager) {
            window.uiManager.hideNavigationBar();
        }
        
        // Reset state
        if (window.appState) {
            window.appState.reset();
        }
        
        // Reinitialize
        this.initialized = false;
        await this.init();
    }

    // Get application info
    getInfo() {
        return {
            initialized: this.initialized,
            modules: Object.keys(this.modules),
            state: window.appState ? window.appState.getFullState() : null,
            url: window.location.href
        };
    }

    // Debug methods
    debug() {
        console.log('App Info:', this.getInfo());
        if (window.appState) {
            window.appState.debugState();
        }
    }
}

// Create and initialize the application
const app = new App();

// Auto-initialize when script loads
app.init().catch(error => {
    console.error('Failed to auto-initialize app:', error);
});

// Export for global access
window.app = app;

// Development helpers
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.debugApp = () => app.debug();
    window.restartApp = () => app.restart();
    console.log('Development mode: debugApp() and restartApp() available');
}