// Utility functions module
class Utils {
    // Strip ANSI escape codes from text
    static stripAnsi(text) {
        return text.replace(/\x1b\[[0-9;]*m/g, '');
    }

    // Convert ANSI escape codes to HTML
    static ansiToHtml(text) {
        const ansiMap = {
            '\x1b[0m': '</span>',  // Reset
            '\x1b[1m': '<span style="font-weight: bold;">',  // Bold
            '\x1b[2m': '<span style="opacity: 0.5;">',  // Dim
            '\x1b[3m': '<span style="font-style: italic;">',  // Italic
            '\x1b[4m': '<span style="text-decoration: underline;">',  // Underline
            '\x1b[30m': '<span style="color: black;">',  // Black
            '\x1b[31m': '<span style="color: red;">',  // Red
            '\x1b[32m': '<span style="color: green;">',  // Green
            '\x1b[33m': '<span style="color: yellow;">',  // Yellow
            '\x1b[34m': '<span style="color: blue;">',  // Blue
            '\x1b[35m': '<span style="color: magenta;">',  // Magenta
            '\x1b[36m': '<span style="color: cyan;">',  // Cyan
            '\x1b[37m': '<span style="color: white;">',  // White
            '\x1b[90m': '<span style="color: gray;">',  // Bright Black (Gray)
            '\x1b[91m': '<span style="color: #ff6b6b;">',  // Bright Red
            '\x1b[92m': '<span style="color: #51cf66;">',  // Bright Green
            '\x1b[93m': '<span style="color: #ffd43b;">',  // Bright Yellow
            '\x1b[94m': '<span style="color: #74c0fc;">',  // Bright Blue
            '\x1b[95m': '<span style="color: #d0bfff;">',  // Bright Magenta
            '\x1b[96m': '<span style="color: #66d9ef;">',  // Bright Cyan
            '\x1b[97m': '<span style="color: white;">',  // Bright White
        };
        
        let result = text;
        for (const [ansi, html] of Object.entries(ansiMap)) {
            result = result.replace(new RegExp(ansi.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), html);
        }
        
        return result;
    }

    // Format file size in human readable format
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Escape HTML characters
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Debounce function
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Throttle function
    static throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Generate random ID
    static generateId(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Check if string is valid JSON
    static isValidJson(str) {
        try {
            JSON.parse(str);
            return true;
        } catch (e) {
            return false;
        }
    }

    // Deep clone object
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (typeof obj === 'object') {
            const clonedObj = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    clonedObj[key] = this.deepClone(obj[key]);
                }
            }
            return clonedObj;
        }
    }
}

// Export for global use
window.Utils = Utils;