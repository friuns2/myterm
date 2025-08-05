// Utility functions for text processing and common operations

/**
 * Strip ANSI escape sequences from text
 * @param {string} text - Text containing ANSI codes
 * @returns {string} - Clean text without ANSI codes
 */
export function stripAnsiCodes(text) {
    return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Convert ANSI escape sequences to HTML
 * @param {string} text - Text containing ANSI codes
 * @returns {string} - HTML formatted text
 */
export function ansiToHtml(text) {
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

/**
 * Get URL parameter value
 * @param {string} param - Parameter name
 * @returns {string|null} - Parameter value or null
 */
export function getURLParameter(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

/**
 * Update URL parameters without page reload
 * @param {Object} params - Object with parameter key-value pairs
 */
export function updateURLParameters(params) {
    const url = new URL(window.location);
    
    // Clear existing parameters if params is null
    if (params === null) {
        url.search = '';
    } else {
        Object.entries(params).forEach(([key, value]) => {
            if (value === null || value === undefined) {
                url.searchParams.delete(key);
            } else {
                url.searchParams.set(key, value);
            }
        });
    }
    
    window.history.pushState({}, '', url);
}

/**
 * Clear all URL parameters
 */
export function clearURLParams() {
    updateURLParameters(null);
}

/**
 * Show loading state on a button
 * @param {HTMLElement} button - Button element
 * @param {string} loadingText - Text to show while loading
 * @returns {Function} - Function to restore original state
 */
export function setButtonLoading(button, loadingText = 'Loading...') {
    const originalText = button.textContent;
    const originalDisabled = button.disabled;
    
    button.textContent = loadingText;
    button.disabled = true;
    
    return () => {
        button.textContent = originalText;
        button.disabled = originalDisabled;
    };
}

/**
 * Debounce function to limit rapid function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
export function debounce(func, wait) {
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