#!/usr/bin/env node
/*
 * Launch Hoo in a clean, isolated auth-trace profile.
 *
 * Use this when WhatsApp Web or Google login fails. It separates three causes:
 * 1. corrupted normal Chromium profile / cookies / IndexedDB
 * 2. Hoo privacy filters breaking auth requests
 * 3. Google rejecting Electron/in-app-browser identity
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const repoRoot = process.cwd();
const electronBin = path.join(repoRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'electron.cmd' : 'electron');
const traceRoot = path.join(os.homedir(), '.local', 'share', 'hoo-browser-auth-trace');
const logFile = path.join(traceRoot, `auth-trace-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);

fs.mkdirSync(traceRoot, { recursive: true });

if (!fs.existsSync(electronBin)) {
  console.error('[Hoo auth trace] electron binary not found. Run npm install first.');
  process.exit(1);
}

const env = {
  ...process.env,
  HOO_AUTH_TRACE: '1',
  HOO_CLEAN_AUTH_PROFILE: '1',
  HOO_USER_DATA_DIR: traceRoot,
  ELECTRON_ENABLE_LOGGING: '1',
  ELECTRON_ENABLE_STACK_DUMPING: '1'
};

console.log('[Hoo auth trace] Launching clean auth profile.');
console.log(`[Hoo auth trace] Profile: ${traceRoot}`);
console.log(`[Hoo auth trace] Log: ${logFile}`);
console.log('[Hoo auth trace] Test these two URLs first:');
console.log('  https://web.whatsapp.com');
console.log('  https://accounts.google.com');

const child = spawn(electronBin, ['.', '--no-sandbox'], {
  cwd: repoRoot,
  env,
  stdio: ['ignore', 'pipe', 'pipe']
});

const out = fs.createWriteStream(logFile, { flags: 'a' });
child.stdout.on('data', chunk => {
  process.stdout.write(chunk);
  out.write(chunk);
});
child.stderr.on('data', chunk => {
  process.stderr.write(chunk);
  out.write(chunk);
});
child.on('exit', code => {
  out.end();
  console.log(`[Hoo auth trace] exited with code ${code}`);
  console.log(`[Hoo auth trace] saved log: ${logFile}`);
});
