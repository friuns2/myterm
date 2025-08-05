// Main script.js - Modularized MyShell Application
// This file serves as the entry point and loads all the modular components

// Import all modules via script tags in HTML:
// - js/utils.js - Utility functions for ANSI processing and URL handling
// - js/terminal.js - Terminal creation and management
// - js/websocket.js - WebSocket connection management
// - js/ui.js - UI management and navigation
// - js/projects.js - Project and session management
// - js/worktrees.js - Worktree operations
// - js/filebrowser.js - File browser and editor functionality
// - js/keyboard.js - Virtual keyboard functionality
// - js/app.js - Main application initialization and event handling

// All functionality has been split into modules for better organization:
// 1. Utils module handles ANSI escape sequences and URL parameters
// 2. Terminal module manages xterm.js terminal instances
// 3. WebSocket module handles all WebSocket communication
// 4. UI module manages navigation and interface elements
// 5. Projects module handles project and session management
// 6. Worktrees module manages Git worktree operations
// 7. FileBrowser module handles file system operations and editor
// 8. Keyboard module manages virtual keyboard functionality
// 9. App module coordinates everything and handles initialization

// The modules are loaded via script tags in the HTML file and expose their
// functionality through the window object for cross-module communication.
// This maintains the same functionality as the original monolithic script
// while providing better code organization and maintainability.

console.log('MyShell modular application loaded. All modules should be available.');