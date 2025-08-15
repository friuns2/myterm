// Port detection functionality

let portDetectionInterval = null;
let detectedPorts = new Set();
let lastDetectedPort = null;

// Common development server ports to monitor (prioritized list)
const COMMON_DEV_PORTS = [
    3000, 3001, 3002, 3003, // React, Next.js
    4000, 4001, 4002, // Gatsby, other frameworks
    5000, 5001, 5002, // Flask, other Python servers
    8000, 8001, 8080, // Django, HTTP servers, Tomcat
    9000, 9001, 9002  // Various dev servers
];

// Function to check if a port is listening using WebSocket connection test
async function checkPort(port) {
    return new Promise((resolve) => {
        // Use WebSocket to test connectivity - it's more reliable for port detection
        const ws = new WebSocket(`ws://localhost:${port}`);
        const timeout = setTimeout(() => {
            ws.close();
            resolve(false);
        }, 500); // Shorter timeout for faster scanning
        
        ws.onopen = () => {
            clearTimeout(timeout);
            ws.close();
            resolve(true);
        };
        
        ws.onerror = () => {
            clearTimeout(timeout);
            // If WebSocket fails, try HTTP fetch as fallback
            fetch(`http://localhost:${port}`, {
                method: 'HEAD',
                mode: 'no-cors',
                cache: 'no-cache',
                signal: AbortSignal.timeout(300)
            })
            .then(() => resolve(true))
            .catch(() => resolve(false));
        };
        
        ws.onclose = (event) => {
            clearTimeout(timeout);
            // If connection was established but closed, port is listening
            if (event.wasClean || event.code === 1000) {
                resolve(true);
            } else {
                resolve(false);
            }
        };
    });
}

// Function to scan for listening ports
async function scanPorts() {
    const currentlyListening = new Set();
    
    // Get current server port from URL
    const currentPort = parseInt(window.location.port) || 80;
    
    // Combine common ports with current server port
    const portsToCheck = [...new Set([currentPort, ...COMMON_DEV_PORTS])];
    
    // Check all ports
    const portChecks = portsToCheck.map(async (port) => {
        const isListening = await checkPort(port);
        if (isListening) {
            currentlyListening.add(port);
        }
        return { port, isListening };
    });
    
    await Promise.all(portChecks);
    
    // Find newly detected ports
    const newPorts = [...currentlyListening].filter(port => !detectedPorts.has(port));
    
    // Update detected ports
    detectedPorts = currentlyListening;
    
    // If we have any listening ports, show the preview button
    if (detectedPorts.size > 0) {
        // Use the lowest port number as the primary one
        const primaryPort = Math.min(...detectedPorts);
        lastDetectedPort = primaryPort;
        showPreviewButton(primaryPort);
        
        // Log new ports for debugging
        if (newPorts.length > 0) {
            console.log('New ports detected:', newPorts);
        }
    } else {
        hidePreviewButton();
        lastDetectedPort = null;
    }
}

// Function to show the preview button
function showPreviewButton(port) {
    const previewButton = document.getElementById('preview-button');
    if (previewButton) {
        previewButton.classList.remove('hidden');
        previewButton.textContent = `🌐 Preview :${port}`;
        previewButton.onclick = () => openPreview(port);
    }
}

// Function to hide the preview button
function hidePreviewButton() {
    const previewButton = document.getElementById('preview-button');
    if (previewButton) {
        previewButton.classList.add('hidden');
        previewButton.onclick = null;
    }
}

// Function to open preview in new tab
function openPreview(port) {
    const url = `http://localhost:${port}`;
    window.open(url, '_blank');
}

// Function to start port detection
function startPortDetection() {
    if (portDetectionInterval) {
        clearInterval(portDetectionInterval);
    }
    
    // Initial scan
    scanPorts();
    
    // Set up periodic scanning every 3 seconds
    portDetectionInterval = setInterval(scanPorts, 3000);
    
    console.log('Port detection started');
}

// Function to stop port detection
function stopPortDetection() {
    if (portDetectionInterval) {
        clearInterval(portDetectionInterval);
        portDetectionInterval = null;
    }
    
    detectedPorts.clear();
    lastDetectedPort = null;
    hidePreviewButton();
    
    console.log('Port detection stopped');
}

// Function to get current detected ports (for debugging)
function getDetectedPorts() {
    return {
        ports: Array.from(detectedPorts),
        primaryPort: lastDetectedPort,
        isRunning: portDetectionInterval !== null
    };
}

// Expose functions globally for debugging
window.portDetection = {
    start: startPortDetection,
    stop: stopPortDetection,
    getStatus: getDetectedPorts,
    scanNow: scanPorts
};

// Auto-start port detection when terminal is active
document.addEventListener('DOMContentLoaded', () => {
    // Start port detection when navigation bar is shown (terminal is active)
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const navBar = document.getElementById('nav-bar');
                if (navBar && !navBar.classList.contains('hidden')) {
                    startPortDetection();
                } else {
                    stopPortDetection();
                }
            }
        });
    });
    
    const navBar = document.getElementById('nav-bar');
    if (navBar) {
        observer.observe(navBar, { attributes: true });
    }
});

// Stop port detection when page is hidden to save resources
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopPortDetection();
    } else {
        // Restart if navigation bar is visible
        const navBar = document.getElementById('nav-bar');
        if (navBar && !navBar.classList.contains('hidden')) {
            startPortDetection();
        }
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopPortDetection();
});