#!/usr/bin/env node

const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// Test script to verify buffer functionality
async function testBufferFunctionality() {
    console.log('Testing buffer functionality...');
    
    // Test 1: Create a new session and send some commands
    console.log('\n1. Creating new session and sending commands...');
    const sessionID = uuidv4();
    const ws1 = new WebSocket(`ws://localhost:8086?sessionID=${sessionID}`);
    
    await new Promise((resolve) => {
        ws1.on('open', () => {
            console.log('Connected to new session');
            
            // Send some test commands
            setTimeout(() => {
                ws1.send(JSON.stringify({ type: 'input', data: 'echo "Hello World"\r' }));
            }, 1000);
            
            setTimeout(() => {
                ws1.send(JSON.stringify({ type: 'input', data: 'pwd\r' }));
            }, 2000);
            
            setTimeout(() => {
                ws1.send(JSON.stringify({ type: 'input', data: 'date\r' }));
            }, 3000);
            
            setTimeout(() => {
                ws1.close();
                resolve();
            }, 4000);
        });
        
        ws1.on('message', (data) => {
            const message = JSON.parse(data);
            if (message.type === 'output') {
                process.stdout.write(message.data);
            } else if (message.type === 'sessionID') {
                console.log(`Session ID: ${message.sessionID}`);
            }
        });
    });
    
    // Test 2: Wait a bit for buffer to be saved, then reconnect
    console.log('\n2. Waiting for buffer to be saved...');
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    console.log('\n3. Reconnecting to same session to test buffer restoration...');
    const ws2 = new WebSocket(`ws://localhost:8086?sessionID=${sessionID}`);
    
    await new Promise((resolve) => {
        let bufferRestored = false;
        
        ws2.on('open', () => {
            console.log('Reconnected to existing session');
        });
        
        ws2.on('message', (data) => {
            const message = JSON.parse(data);
            if (message.type === 'restore_buffer') {
                console.log('\n--- BUFFER RESTORATION ---');
                console.log('Buffer content:');
                console.log(message.data);
                console.log('--- END BUFFER ---');
                bufferRestored = true;
            } else if (message.type === 'output') {
                process.stdout.write(message.data);
            }
        });
        
        setTimeout(() => {
            if (bufferRestored) {
                console.log('\n✅ Buffer restoration test PASSED');
            } else {
                console.log('\n❌ Buffer restoration test FAILED');
            }
            ws2.close();
            resolve();
        }, 3000);
    });
    
    console.log('\nTest completed!');
    process.exit(0);
}

// Run the test
testBufferFunctionality().catch(console.error);
