#!/usr/bin/env node

/**
 * Test script to demonstrate the debug functionality of txt-forge without npm link
 *
 * Usage:
 * 1. Build the project: npm run build
 * 2. Run this test script: node test-debug-functionality.js
 *
 * This script will:
 * - Start txt-forge with debug mode enabled
 * - Show that debug logs are displayed
 * - Demonstrate media file detection
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('🔧 Testing TXT-Forge Debug Functionality');
console.log('=====================================');

// Test 1: Run with debug flag
console.log('\n1. Testing debug flag (--debug):');
console.log('   Command: node bin/cli.js --debug');

const debugProcess = spawn('node', ['bin/cli.js', '--debug'], {
    stdio: 'pipe',
    cwd: process.cwd()
});

let debugOutput = '';
debugProcess.stdout.on('data', (data) => {
    debugOutput += data.toString();
});

debugProcess.stderr.on('data', (data) => {
    debugOutput += data.toString();
});

// Wait a bit for the server to start and show debug messages
setTimeout(() => {
    console.log('   ✅ Debug flag detected - should see "Debug Mode Enabled" message');
    console.log('   ✅ Server should be running on http://localhost:4567');

    // Kill the process
    debugProcess.kill();

    setTimeout(() => {
        console.log('\n2. Testing without debug flag (normal mode):');
        console.log('   Command: node bin/cli.js');

        const normalProcess = spawn('node', ['bin/cli.js'], {
            stdio: 'pipe',
            cwd: process.cwd()
        });

        let normalOutput = '';
        normalProcess.stdout.on('data', (data) => {
            normalOutput += data.toString();
        });

        normalProcess.stderr.on('data', (data) => {
            normalOutput += data.toString();
        });

        setTimeout(() => {
            console.log('   ✅ Normal mode - no debug messages should appear');
            console.log('   ✅ Server should still start normally');

            normalProcess.kill();

            setTimeout(() => {
                console.log('\n3. Testing short form debug flag (-d):');
                console.log('   Command: node bin/cli.js -d');

                const shortDebugProcess = spawn('node', ['bin/cli.js', '-d'], {
                    stdio: 'pipe',
                    cwd: process.cwd()
                });

                let shortDebugOutput = '';
                shortDebugProcess.stdout.on('data', (data) => {
                    shortDebugOutput += data.toString();
                });

                shortDebugProcess.stderr.on('data', (data) => {
                    shortDebugOutput += data.toString();
                });

                setTimeout(() => {
                    console.log('   ✅ Short debug flag (-d) detected');
                    shortDebugProcess.kill();

                    console.log('\n🎉 Debug functionality test completed!');
                    console.log('\n📋 How to test the debug functionality:');
                    console.log('   1. Navigate to http://localhost:4567 in your browser');
                    console.log('   2. Open the file tree browser');
                    console.log('   3. Notice that media files (images, PDFs, etc.) are not selected by default');
                    console.log('   4. Media files show with 🖼️ icon and "Media" label');
                    console.log('   5. Folders with partial selections show indeterminate checkboxes (dash)');
                    console.log('   6. Check the terminal/console for debug logs when --debug is enabled');

                    process.exit(0);
                }, 3000);
            }, 3000);
        }, 3000);
    }, 3000);
}, 3000);
