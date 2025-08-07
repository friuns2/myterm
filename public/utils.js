// Utility functions for the web terminal application

// Function to strip ANSI escape sequences from text
function stripAnsiCodes(text) {
    // Remove ANSI escape sequences
    return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

// Function to convert ANSI escape sequences to HTML
function ansiToHtml(text) {
    // Basic ANSI color codes mapping
    const ansiColors = {
        '30': 'color: #000000', // black
        '31': 'color: #ff0000', // red
        '32': 'color: #00ff00', // green
        '33': 'color: #ffff00', // yellow
        '34': 'color: #0000ff', // blue
        '35': 'color: #ff00ff', // magenta
        '36': 'color: #00ffff', // cyan
        '37': 'color: #ffffff', // white
        '90': 'color: #808080', // bright black (gray)
        '91': 'color: #ff8080', // bright red
        '92': 'color: #80ff80', // bright green
        '93': 'color: #ffff80', // bright yellow
        '94': 'color: #8080ff', // bright blue
        '95': 'color: #ff80ff', // bright magenta
        '96': 'color: #80ffff', // bright cyan
        '97': 'color: #ffffff'  // bright white
    };
    
    let result = text;
    let openSpans = 0;
    
    // Handle 256-color sequences like [38;2;r;g;b;m
    result = result.replace(/\x1b\[38;2;(\d+);(\d+);(\d+)m/g, (match, r, g, b) => {
        openSpans++;
        return `<span style="color: rgb(${r}, ${g}, ${b})">`;
    });
    
    // Handle basic color codes
    result = result.replace(/\x1b\[(\d+)m/g, (match, code) => {
        if (code === '0' || code === 'm') {
            // Reset - close all spans
            const closeSpans = '</span>'.repeat(openSpans);
            openSpans = 0;
            return closeSpans;
        }
        if (ansiColors[code]) {
            openSpans++;
            return `<span style="${ansiColors[code]}">`;
        }
        return ''; // Remove unhandled codes
    });
    
    // Remove any remaining ANSI sequences
    result = result.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    
    // Close any remaining open spans
    result += '</span>'.repeat(openSpans);
    
    return result;
}

// Enhanced URI Query Handling and Settings Management
class URIQueryManager {
    constructor() {
        this.supportedParams = {
            session: { type: 'string', persistent: false },
            project: { type: 'string', persistent: false },
            theme: { type: 'string', persistent: true, default: 'dark' },
            fontSize: { type: 'number', persistent: true, default: 14 },
            terminalCols: { type: 'number', persistent: true, default: 80 },
            terminalRows: { type: 'number', persistent: true, default: 24 },
            autoSave: { type: 'boolean', persistent: true, default: true },
            showLineNumbers: { type: 'boolean', persistent: true, default: false },
            wordWrap: { type: 'boolean', persistent: true, default: true }
        };
        this.storageKey = 'myshell24_settings';
        this.loadSettings();
    }

    // Get parameter value with fallback to settings or default
    get(paramName) {
        const config = this.supportedParams[paramName];
        if (!config) return null;

        // First check URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const urlValue = urlParams.get(paramName);
        
        if (urlValue !== null) {
            return this.parseValue(urlValue, config.type);
        }

        // Then check persistent settings
        if (config.persistent && this.settings[paramName] !== undefined) {
            return this.settings[paramName];
        }

        // Finally return default
        return config.default || null;
    }

    // Set parameter value and optionally update URL
    set(paramName, value, updateURL = true, persistent = null) {
        const config = this.supportedParams[paramName];
        if (!config) {
            console.warn(`Unknown parameter: ${paramName}`);
            return false;
        }

        const parsedValue = this.parseValue(value, config.type);
        
        // Update URL if requested
        if (updateURL) {
            this.updateURL({ [paramName]: parsedValue });
        }

        // Save to persistent settings if configured
        const shouldPersist = persistent !== null ? persistent : config.persistent;
        if (shouldPersist) {
            this.settings[paramName] = parsedValue;
            this.saveSettings();
        }

        return true;
    }

    // Get multiple parameters at once
    getMultiple(paramNames) {
        const result = {};
        paramNames.forEach(name => {
            result[name] = this.get(name);
        });
        return result;
    }

    // Set multiple parameters at once
    setMultiple(params, updateURL = true, persistent = null) {
        const urlUpdates = {};
        
        Object.entries(params).forEach(([name, value]) => {
            const config = this.supportedParams[name];
            if (!config) {
                console.warn(`Unknown parameter: ${name}`);
                return;
            }

            const parsedValue = this.parseValue(value, config.type);
            
            if (updateURL) {
                urlUpdates[name] = parsedValue;
            }

            const shouldPersist = persistent !== null ? persistent : config.persistent;
            if (shouldPersist) {
                this.settings[name] = parsedValue;
            }
        });

        if (updateURL && Object.keys(urlUpdates).length > 0) {
            this.updateURL(urlUpdates);
        }

        if (persistent !== false) {
            this.saveSettings();
        }
    }

    // Update URL with new parameters
    updateURL(params, replaceState = false) {
        const url = new URL(window.location);
        
        Object.entries(params).forEach(([name, value]) => {
            if (value === null || value === undefined) {
                url.searchParams.delete(name);
            } else {
                url.searchParams.set(name, String(value));
            }
        });

        const method = replaceState ? 'replaceState' : 'pushState';
        window.history[method]({ params }, '', url);
    }

    // Clear specific parameters from URL
    clearParams(paramNames, updateHistory = true) {
        const url = new URL(window.location);
        paramNames.forEach(name => {
            url.searchParams.delete(name);
        });
        
        if (updateHistory) {
            window.history.pushState({}, '', url);
        }
    }

    // Clear all non-persistent parameters
    clearTemporaryParams() {
        const tempParams = Object.keys(this.supportedParams)
            .filter(name => !this.supportedParams[name].persistent);
        this.clearParams(tempParams);
    }

    // Parse value according to type
    parseValue(value, type) {
        switch (type) {
            case 'number':
                const num = Number(value);
                return isNaN(num) ? null : num;
            case 'boolean':
                if (typeof value === 'boolean') return value;
                return value === 'true' || value === '1';
            case 'string':
            default:
                return String(value);
        }
    }

    // Load settings from localStorage
    loadSettings() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            this.settings = stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.warn('Failed to load settings:', error);
            this.settings = {};
        }
    }

    // Save settings to localStorage
    saveSettings() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
        } catch (error) {
            console.warn('Failed to save settings:', error);
        }
    }

    // Reset all settings to defaults
    resetSettings() {
        this.settings = {};
        this.saveSettings();
        
        // Apply defaults to URL for persistent params
        const defaults = {};
        Object.entries(this.supportedParams).forEach(([name, config]) => {
            if (config.persistent && config.default !== undefined) {
                defaults[name] = config.default;
            }
        });
        
        if (Object.keys(defaults).length > 0) {
            this.updateURL(defaults, true);
        }
    }

    // Get all current settings (URL + persistent)
    getAllSettings() {
        const result = {};
        Object.keys(this.supportedParams).forEach(name => {
            result[name] = this.get(name);
        });
        return result;
    }

    // Export settings as JSON
    exportSettings() {
        return JSON.stringify(this.getAllSettings(), null, 2);
    }

    // Import settings from JSON
    importSettings(jsonString, updateURL = true) {
        try {
            const imported = JSON.parse(jsonString);
            this.setMultiple(imported, updateURL, true);
            return true;
        } catch (error) {
            console.error('Failed to import settings:', error);
            return false;
        }
    }
}

// Create global instance
const uriQuery = new URIQueryManager();

// Legacy compatibility functions
function getSessionIDFromURL() {
    return uriQuery.get('session');
}

function getProjectFromURL() {
    return uriQuery.get('project');
}

function updateURLWithSession(sessionId, projectName = null) {
    const params = { session: sessionId };
    if (projectName) {
        params.project = projectName;
    }
    uriQuery.setMultiple(params, true, false);
}

function clearURLParams() {
    uriQuery.clearParams(['session', 'project']);
}

// Enhanced settings management functions
function getAppSettings() {
    return uriQuery.getAllSettings();
}

function updateAppSetting(name, value, persistent = true) {
    return uriQuery.set(name, value, false, persistent);
}

function updateAppSettings(settings, persistent = true) {
    uriQuery.setMultiple(settings, false, persistent);
}

function resetAppSettings() {
    uriQuery.resetSettings();
}

function exportAppSettings() {
    return uriQuery.exportSettings();
}

function importAppSettings(jsonString) {
    return uriQuery.importSettings(jsonString, false);
}