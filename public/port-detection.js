// Port detection functionality

let portDetectionInterval = null;
let detectedPorts = new Set();
let lastDetectedPort = null;

// Common development server ports to monitor
const COMMON_DEV_PORTS = [
    3000, 3001, 3002, 3003, 3004, 3005,
    4000, 4001, 4002, 4003, 4004, 4005,
    5000, 5001, 5002, 5003, 5004, 5005,
    8000, 8001, 8002, 8003, 8004, 8005,
    8080, 8081, 8082, 8083, 8084, 8085,
    9000, 9001, 9002, 9003, 9004, 9005
];

// Function to check if a port is listening
async function checkPort(port) {
    try {
        // Try to create a connection to the port
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);
        
        const response = await fetch(`http://localhost:${port}`, {
            method: 'HEAD',
            mode: 'no-cors',
            cache: 'no-cache',
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return true;
    } catch (error) {
        // For CORS or network errors, try a different approach
        try {
            // Create an image element to test connectivity
            return new Promise((resolve) => {
                const img = new Image();
                const timeout = setTimeout(() => {
                    img.onload = img.onerror = null;
                    resolve(false);
                }, 1000);
                
                img.onload = () => {
                    clearTimeout(timeout);
                    resolve(true);
                };
                
                img.onerror = () => {
                    clearTimeout(timeout);
                    // If we get an error, it might still mean the port is listening
                    // but serving content that's not an image
                    resolve(true);
                };
                
                img.src = `http://localhost:${port}/favicon.ico?t=${Date.now()}`;
            });
        } catch (fallbackError) {
            return false;
        }
    }
}

// Function to scan for listening ports
async function scanPorts() {
    const currentlyListening = new Set();
    
    // Check common development ports
    const portChecks = COMMON_DEV_PORTS.map(async (port) => {
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