const output = document.getElementById('output');
const input = document.getElementById('command-input');
const terminal = document.getElementById('terminal');

// WebSocket connection
const ws = new WebSocket(`ws://${window.location.host}`);

ws.onopen = () => {
    console.log('Connected to terminal');
};

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    
    if (message.type === 'clear') {
        output.textContent = '';
        return;
    }
    
    if (message.type === 'output') {
        output.textContent += message.data;
        output.scrollTop = output.scrollHeight;
    }
};

ws.onclose = () => {
    output.textContent += '\nConnection lost. Refresh to reconnect.\n';
};

ws.onerror = (error) => {
    output.textContent += `\nWebSocket error: ${error}\n`;
};

// Handle command input
input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const command = input.value.trim();
        
        if (command) {
            // Show command in output
            output.textContent += `${command}\n`;
            
            // Send command to server
            ws.send(JSON.stringify({ command }));
            
            // Clear input
            input.value = '';
            
            // Scroll to bottom
            output.scrollTop = output.scrollHeight;
        }
    }
});

// Keep input focused
terminal.addEventListener('click', () => {
    input.focus();
});

// Command history
let history = [];
let historyIndex = -1;

input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (history.length > 0 && historyIndex < history.length - 1) {
            historyIndex++;
            input.value = history[history.length - 1 - historyIndex];
        }
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex > 0) {
            historyIndex--;
            input.value = history[history.length - 1 - historyIndex];
        } else if (historyIndex === 0) {
            historyIndex = -1;
            input.value = '';
        }
    } else if (e.key === 'Enter' && input.value.trim()) {
        history.push(input.value.trim());
        historyIndex = -1;
    }
}); 