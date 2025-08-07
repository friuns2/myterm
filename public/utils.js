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