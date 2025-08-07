// History management for navigation between windows/views

class NavigationHistory {
    constructor() {
        this.history = [];
        this.currentIndex = -1;
        this.maxHistorySize = 50;
        
        // Initialize with the current state (sessions list)
        this.pushState({
            type: 'sessions',
            title: 'Sessions & Projects',
            data: {}
        });
    }

    // Push a new state to history
    pushState(state) {
        // Remove any forward history when pushing new state
        this.history = this.history.slice(0, this.currentIndex + 1);
        
        // Add new state
        this.history.push({
            ...state,
            timestamp: Date.now(),
            id: this.generateStateId()
        });
        
        this.currentIndex = this.history.length - 1;
        
        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.currentIndex--;
        }
        
        this.updateNavigationButtons();
        this.updateURL(state);
    }

    // Navigate back in history
    goBack() {
        if (this.canGoBack()) {
            this.currentIndex--;
            const state = this.getCurrentState();
            this.navigateToState(state);
            this.updateNavigationButtons();
            return true;
        }
        return false;
    }

    // Navigate forward in history
    goForward() {
        if (this.canGoForward()) {
            this.currentIndex++;
            const state = this.getCurrentState();
            this.navigateToState(state);
            this.updateNavigationButtons();
            return true;
        }
        return false;
    }

    // Check if we can go back
    canGoBack() {
        return this.currentIndex > 0;
    }

    // Check if we can go forward
    canGoForward() {
        return this.currentIndex < this.history.length - 1;
    }

    // Get current state
    getCurrentState() {
        return this.history[this.currentIndex] || null;
    }

    // Get previous state
    getPreviousState() {
        return this.history[this.currentIndex - 1] || null;
    }

    // Navigate to a specific state
    async navigateToState(state) {
        if (!state) return;

        try {
            switch (state.type) {
                case 'sessions':
                    await this.navigateToSessions();
                    break;
                case 'terminal':
                    await this.navigateToTerminal(state.data);
                    break;
                case 'environment':
                    await this.navigateToEnvironment();
                    break;
                case 'aliases':
                    await this.navigateToAliases();
                    break;
                case 'files':
                    await this.navigateToFiles(state.data);
                    break;
                default:
                    console.warn('Unknown state type:', state.type);
            }
        } catch (error) {
            console.error('Error navigating to state:', error);
        }
    }

    // Navigation methods for different views
    async navigateToSessions() {
        // Cleanup terminal if active
        if (typeof cleanupTerminal === 'function') {
            cleanupTerminal();
        }
        
        sessionID = null;
        currentProject = null;
        await showSessionsAndProjectsList();
    }

    async navigateToTerminal(data) {
        const { sessionId, projectName } = data;
        
        if (sessionId) {
            // Connect to existing session
            sessionID = sessionId;
            currentProject = projectName;
            initializeTerminal();
        } else if (projectName) {
            // Create new session for project
            currentProject = projectName;
            sessionID = null;
            initializeTerminal();
        }
    }

    async navigateToEnvironment() {
        await showEnvironmentManager();
    }

    async navigateToAliases() {
        await showAliasesManager();
    }

    async navigateToFiles(data) {
        // Implementation for file browser navigation
        // This would need to be implemented based on file browser functionality
        console.log('Navigate to files:', data);
    }

    // Generate unique state ID
    generateStateId() {
        return `state_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Update navigation buttons
    updateNavigationButtons() {
        const backBtn = document.getElementById('nav-back-btn');
        const forwardBtn = document.getElementById('nav-forward-btn');
        
        if (backBtn) {
            backBtn.disabled = !this.canGoBack();
            backBtn.classList.toggle('btn-disabled', !this.canGoBack());
        }
        
        if (forwardBtn) {
            forwardBtn.disabled = !this.canGoForward();
            forwardBtn.classList.toggle('btn-disabled', !this.canGoForward());
        }

        // Update tooltips
        if (backBtn && this.canGoBack()) {
            const prevState = this.history[this.currentIndex - 1];
            backBtn.title = `Back to: ${prevState.title}`;
        }
        
        if (forwardBtn && this.canGoForward()) {
            const nextState = this.history[this.currentIndex + 1];
            forwardBtn.title = `Forward to: ${nextState.title}`;
        }
    }

    // Update URL to reflect current state
    updateURL(state) {
        const url = new URL(window.location);
        
        switch (state.type) {
            case 'sessions':
                url.searchParams.delete('session');
                url.searchParams.delete('project');
                break;
            case 'terminal':
                if (state.data.sessionId) {
                    url.searchParams.set('session', state.data.sessionId);
                }
                if (state.data.projectName) {
                    url.searchParams.set('project', state.data.projectName);
                }
                break;
            case 'environment':
                url.searchParams.set('view', 'environment');
                break;
            case 'aliases':
                url.searchParams.set('view', 'aliases');
                break;
        }
        
        // Update URL without triggering page reload
        window.history.replaceState(null, '', url.toString());
    }

    // Get history summary for debugging
    getHistorySummary() {
        return {
            total: this.history.length,
            current: this.currentIndex,
            canGoBack: this.canGoBack(),
            canGoForward: this.canGoForward(),
            currentState: this.getCurrentState(),
            history: this.history.map((state, index) => ({
                index,
                type: state.type,
                title: state.title,
                isCurrent: index === this.currentIndex
            }))
        };
    }

    // Clear history (useful for testing or reset)
    clearHistory() {
        this.history = [];
        this.currentIndex = -1;
        this.pushState({
            type: 'sessions',
            title: 'Sessions & Projects',
            data: {}
        });
    }
}

// Global navigation history instance
const navigationHistory = new NavigationHistory();

// Keyboard shortcuts for navigation
document.addEventListener('keydown', (event) => {
    // Alt + Left Arrow = Back
    if (event.altKey && event.key === 'ArrowLeft') {
        event.preventDefault();
        navigationHistory.goBack();
    }
    
    // Alt + Right Arrow = Forward
    if (event.altKey && event.key === 'ArrowRight') {
        event.preventDefault();
        navigationHistory.goForward();
    }
});

// Browser back/forward button support
window.addEventListener('popstate', (event) => {
    // Handle browser back/forward buttons
    // This is a simplified implementation
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session');
    const projectName = urlParams.get('project');
    const view = urlParams.get('view');
    
    if (sessionId || projectName) {
        navigationHistory.navigateToTerminal({ sessionId, projectName });
    } else if (view === 'environment') {
        navigationHistory.navigateToEnvironment();
    } else if (view === 'aliases') {
        navigationHistory.navigateToAliases();
    } else {
        navigationHistory.navigateToSessions();
    }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NavigationHistory, navigationHistory };
}