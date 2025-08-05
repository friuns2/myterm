// Main Vue 2 application
new Vue({
    el: '#app',
    data: {
        currentView: 'loading', // 'loading', 'sessionList', 'terminal'
        sessions: [],
        currentSessionID: null,
        isConnected: false,
        isLoading: false,
        error: null,
        terminalManager: null,
        webSocketManager: null,
        sessionManager: null,
        uiManager: null
    },
    
    mounted() {
        this.initializeManagers();
        this.setupBrowserNavigation();
        this.determineInitialView();
    },
    
    methods: {
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
            const sessionID = this.sessionManager.getCurrentSessionID();
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
                this.error = 'Failed to load sessions';
                console.error('Failed to load sessions:', error);
                // If we can't load sessions, create a new one
                this.createNewSession();
            } finally {
                this.isLoading = false;
            }
        },
        
        showTerminal() {
            this.currentView = 'terminal';
            this.$nextTick(() => {
                this.initializeTerminal();
            });
        },
        
        initializeTerminal() {
            // Mount terminal to DOM
            this.terminalManager.mount('terminal');
            
            // Initialize UI components
            this.uiManager.initializeUIComponents();
            
            // Connect WebSocket
            this.webSocketManager.connect(this.currentSessionID);
            this.isConnected = true;
        },
        
        connectToSession(sessionId) {
            this.currentSessionID = this.sessionManager.connectToSession(sessionId);
            this.showTerminal();
        },
        
        async killSession(sessionId) {
            try {
                await this.sessionManager.killSession(sessionId);
                // Refresh session list
                this.sessions = await this.sessionManager.getSessions();
            } catch (error) {
                alert('Failed to kill session: ' + error.message);
            }
        },
        
        createNewSession() {
            this.currentSessionID = this.sessionManager.createNewSession();
            this.showTerminal();
        },
        
        goBackToSessionList() {
            this.sessionManager.removeSessionFromURL();
            this.webSocketManager.disconnect();
            this.isConnected = false;
            this.currentSessionID = null;
            this.showSessionList();
        },
        
        formatDate(dateString) {
            return new Date(dateString).toLocaleString();
        }
    },
    
    template: `
        <div class="h-screen flex flex-col overflow-hidden">
            <!-- Loading View -->
            <div v-if="currentView === 'loading'" class="flex-1 flex items-center justify-center">
                <div class="text-center">
                    <div class="loading loading-spinner loading-lg"></div>
                    <p class="mt-4">{{ isLoading ? 'Loading sessions...' : 'Initializing...' }}</p>
                    <p v-if="error" class="text-error mt-2">{{ error }}</p>
                </div>
            </div>
            
            <!-- Session List View -->
            <div v-else-if="currentView === 'sessionList'" class="flex-1 p-6 overflow-auto">
                <div class="max-w-4xl mx-auto">
                    <h1 class="text-2xl font-bold mb-6 text-center">Terminal Sessions</h1>
                    
                    <div class="grid gap-4 mb-6">
                        <div v-for="session in sessions" :key="session.id" class="card bg-base-200 shadow-xl">
                            <div class="card-body p-4">
                                <div class="flex justify-between items-start">
                                    <div class="cursor-pointer flex-1" @click="connectToSession(session.id)">
                                        <h2 class="card-title text-sm">{{ session.id }}</h2>
                                        <p class="text-xs opacity-70">Status: {{ session.status }}</p>
                                        <p class="text-xs opacity-50">Created: {{ formatDate(session.created) }}</p>
                                    </div>
                                    <button class="btn btn-error btn-sm ml-2" @click="killSession(session.id)">
                                        Kill
                                    </button>
                                </div>
                            </div>
                        </div>
                        
                        <div v-if="sessions.length === 0" class="text-center py-8">
                            <p class="text-base-content/70">No active sessions</p>
                        </div>
                    </div>
                    
                    <div class="text-center">
                        <button class="btn btn-primary" @click="createNewSession()">
                            Create New Session
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Terminal View -->
            <div v-else-if="currentView === 'terminal'" class="flex-1 flex flex-col overflow-hidden">
                <!-- Terminal Header -->
                <div class="bg-base-200 p-2 border-b border-base-300">
                    <button class="btn btn-sm btn-outline" @click="goBackToSessionList()">
                        ← Back to Sessions
                    </button>
                    <span v-if="currentSessionID" class="ml-4 text-sm opacity-70">
                        Session: {{ currentSessionID }}
                    </span>
                </div>
                
                <!-- Terminal Container -->
                <div class="flex-1 bg-black p-2 overflow-hidden">
                    <div id="terminal" class="w-full h-full"></div>
                </div>
                
                <!-- Command Input Section -->
                <div class="bg-base-200 p-2 border-t border-base-300">
                    <div class="flex gap-2 items-center">
                        <input type="text" id="custom-command-input" placeholder="Enter command..." 
                               class="input input-bordered input-sm flex-1 bg-base-100 text-sm" />
                        <button id="send-command-button" class="btn btn-primary btn-sm">Send</button>
                    </div>
                </div>
                
                <!-- Virtual Keyboard for Mobile -->
                <div id="virtual-keyboard" class="bg-base-200 p-2 border-t border-base-300 lg:hidden">
                    <div class="flex gap-1 justify-center flex-wrap">
                        <button class="btn btn-xs btn-outline" data-key-code="27">Esc</button>
                        <button class="btn btn-xs btn-outline" data-key-code="9">Tab</button>
                        <button class="btn btn-xs btn-outline" data-key-code="17">Ctrl</button>
                        <button class="btn btn-xs btn-outline" data-key-code="38">↑</button>
                        <button class="btn btn-xs btn-outline" data-key-code="37">←</button>
                        <button class="btn btn-xs btn-outline" data-key-code="40">↓</button>
                        <button class="btn btn-xs btn-outline" data-key-code="39">→</button>
                    </div>
                </div>
            </div>
        </div>
    `
});