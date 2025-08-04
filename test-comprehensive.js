#!/usr/bin/env node

const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

// Comprehensive test for all buffer functionality
async function runComprehensiveTest() {
    console.log('🧪 Running comprehensive buffer functionality test...\n');
    
    const sessionID = uuidv4();
    let testsPassed = 0;
    let totalTests = 0;
    
    // Test 1: New session creation and buffer capture
    console.log('Test 1: Creating new session and capturing buffer...');
    totalTests++;
    
    const ws1 = new WebSocket(`ws://localhost:8086?sessionID=${sessionID}`);
    
    await new Promise((resolve) => {
        let sessionReceived = false;
        
        ws1.on('open', () => {
            console.log('✅ Connected to new session');
            
            // Send test commands
            setTimeout(() => ws1.send(JSON.stringify({ type: 'input', data: 'echo "Test 1: Buffer capture"\r' })), 500);
            setTimeout(() => ws1.send(JSON.stringify({ type: 'input', data: 'whoami\r' })), 1000);
            setTimeout(() => ws1.send(JSON.stringify({ type: 'input', data: 'echo "End of test 1"\r' })), 1500);
            
            setTimeout(() => {
                ws1.close();
                resolve();
            }, 2500);
        });
        
        ws1.on('message', (data) => {
            const message = JSON.parse(data);
            if (message.type === 'sessionID') {
                console.log(`✅ Session ID received: ${message.sessionID}`);
                sessionReceived = true;
            } else if (message.type === 'output') {
                process.stdout.write(message.data);
            }
        });
        
        ws1.on('close', () => {
            if (sessionReceived) {
                console.log('✅ Test 1 PASSED\n');
                testsPassed++;
            } else {
                console.log('❌ Test 1 FAILED\n');
            }
        });
    });
    
    // Test 2: Buffer restoration
    console.log('Test 2: Waiting for buffer save and testing restoration...');
    totalTests++;
    await new Promise(resolve => setTimeout(resolve, 6000)); // Wait for buffer save
    
    const ws2 = new WebSocket(`ws://localhost:8086?sessionID=${sessionID}`);
    
    await new Promise((resolve) => {
        let bufferRestored = false;
        
        ws2.on('open', () => {
            console.log('✅ Reconnected to existing session');
        });
        
        ws2.on('message', (data) => {
            const message = JSON.parse(data);
            if (message.type === 'restore_buffer') {
                console.log('✅ Buffer restoration message received');
                console.log(`Buffer size: ${message.data.length} characters`);
                if (message.data.includes('Test 1: Buffer capture') && message.data.includes('End of test 1')) {
                    console.log('✅ Buffer contains expected content');
                    bufferRestored = true;
                } else {
                    console.log('❌ Buffer missing expected content');
                }
            }
        });
        
        setTimeout(() => {
            if (bufferRestored) {
                console.log('✅ Test 2 PASSED\n');
                testsPassed++;
            } else {
                console.log('❌ Test 2 FAILED\n');
            }
            ws2.close();
            resolve();
        }, 3000);
    });
    
    // Test 3: Buffer clearing
    console.log('Test 3: Testing buffer clearing functionality...');
    totalTests++;
    
    const ws3 = new WebSocket(`ws://localhost:8086?sessionID=${sessionID}`);
    
    await new Promise((resolve) => {
        let bufferCleared = false;
        
        ws3.on('open', () => {
            console.log('✅ Connected for buffer clear test');
            
            // Send clear buffer command
            setTimeout(() => {
                ws3.send(JSON.stringify({ type: 'clear_buffer' }));
            }, 1000);
        });
        
        ws3.on('message', (data) => {
            const message = JSON.parse(data);
            if (message.type === 'buffer_cleared') {
                console.log('✅ Buffer cleared confirmation received');
                bufferCleared = true;
            }
        });
        
        setTimeout(() => {
            if (bufferCleared) {
                console.log('✅ Test 3 PASSED\n');
                testsPassed++;
            } else {
                console.log('❌ Test 3 FAILED\n');
            }
            ws3.close();
            resolve();
        }, 3000);
    });
    
    // Test 4: Verify buffer is actually cleared
    console.log('Test 4: Verifying buffer was actually cleared...');
    totalTests++;
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for save
    
    const ws4 = new WebSocket(`ws://localhost:8086?sessionID=${sessionID}`);
    
    await new Promise((resolve) => {
        let bufferEmpty = false;
        let restoreReceived = false;
        
        ws4.on('open', () => {
            console.log('✅ Connected to verify empty buffer');
        });
        
        ws4.on('message', (data) => {
            const message = JSON.parse(data);
            if (message.type === 'restore_buffer') {
                restoreReceived = true;
                if (!message.data || message.data.length === 0) {
                    console.log('✅ Buffer is empty as expected');
                    bufferEmpty = true;
                } else {
                    console.log(`❌ Buffer still contains ${message.data.length} characters`);
                }
            }
        });
        
        setTimeout(() => {
            if (bufferEmpty || !restoreReceived) {
                console.log('✅ Test 4 PASSED\n');
                testsPassed++;
            } else {
                console.log('❌ Test 4 FAILED\n');
            }
            ws4.close();
            resolve();
        }, 3000);
    });
    
    // Summary
    console.log('='.repeat(50));
    console.log(`📊 Test Results: ${testsPassed}/${totalTests} tests passed`);
    
    if (testsPassed === totalTests) {
        console.log('🎉 All tests PASSED! Buffer functionality is working correctly.');
    } else {
        console.log('⚠️  Some tests FAILED. Please check the implementation.');
    }
    
    process.exit(testsPassed === totalTests ? 0 : 1);
}

// Run the comprehensive test
runComprehensiveTest().catch(console.error);
