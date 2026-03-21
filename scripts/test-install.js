#!/usr/bin/env node
/**
 * UAB Bridge Installation Verification Test
 *
 * Tests all 8 steps to confirm a working installation.
 * This is the definition of done — 8/8 PASS means it works.
 */

import { existsSync, readFileSync } from 'fs';
import { resolve, join } from 'path';
import { homedir, platform } from 'os';
import http from 'http';
import { execSync } from 'child_process';

const PORT = 3100;
const BASE = `http://127.0.0.1:${PORT}`;

let passed = 0;
let failed = 0;

async function test(name, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    const ms = Date.now() - start;
    console.log(`  PASS  ${name} (${ms}ms)`);
    if (result) console.log(`        ${result}`);
    passed++;
  } catch (err) {
    const ms = Date.now() - start;
    console.log(`  FAIL  ${name} (${ms}ms)`);
    console.log(`        ${err.message || err}`);
    failed++;
  }
}

function post(path, body = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
      timeout: 10000,
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => chunks += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(chunks);
          if (json.error) reject(new Error(json.error));
          else resolve(json);
        } catch {
          reject(new Error(`Non-JSON response: ${chunks.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.write(data);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.get(`${BASE}${path}`, { timeout: 5000 }, (res) => {
      let chunks = '';
      res.on('data', (c) => chunks += c);
      res.on('end', () => {
        try { resolve(JSON.parse(chunks)); }
        catch { reject(new Error(`Non-JSON: ${chunks.substring(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timed out')); });
  });
}

function findSkillFile() {
  const home = homedir();

  // Primary location: Claude Code plugin system
  const pluginPath = join(
    home, '.claude', 'plugins', 'marketplaces', 'claude-plugins-official',
    'plugins', 'uab-bridge', 'skills', 'uab-bridge', 'SKILL.md',
  );
  if (existsSync(pluginPath)) return pluginPath;

  // Fallback: check env override
  if (process.env.COWORK_SKILLS_DIR) {
    const envPath = join(process.env.COWORK_SKILLS_DIR, 'uab-bridge', 'SKILL.md');
    if (existsSync(envPath)) return envPath;
  }

  return null;
}

async function main() {
  console.log('');
  console.log('UAB Bridge Installation Verification');
  console.log('====================================');
  console.log('');

  // Test 1: Health check
  await test('1. Server /health responds', async () => {
    const data = await get('/health');
    if (data.status !== 'ok') throw new Error(`Status: ${data.status}`);
    return `version=${data.version}, uptime=${data.uptime}s`;
  });

  // Test 2: Skill file exists and is non-empty
  await test('2. Skill file exists and is non-empty', async () => {
    const path = findSkillFile();
    if (!path) throw new Error('Skill file uab-bridge.md not found in any known location');
    const content = readFileSync(path, 'utf-8');
    if (content.length < 100) throw new Error(`File too small: ${content.length} bytes`);
    return `${path} (${content.length} chars)`;
  });

  // Test 3: /scan returns without error
  await test('3. /scan returns app list', async () => {
    const data = await post('/scan');
    if (typeof data.count !== 'number') throw new Error('No count in response');
    return `Found ${data.count} applications`;
  });

  // Test 4: /find notepad returns a result
  await test('4. /find notepad returns result', async () => {
    // Launch notepad first if not running
    if (platform() === 'win32') {
      try {
        execSync('tasklist /fi "imagename eq notepad.exe" | findstr notepad.exe', { stdio: 'pipe' });
      } catch {
        // Notepad not running, launch it
        execSync('start notepad.exe', { stdio: 'pipe', shell: true });
        // Wait for it to start
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    const data = await post('/find', { query: 'notepad' });
    if (data.count === 0) throw new Error('No notepad found (is Notepad running?)');
    return `Found ${data.count} match(es): ${data.apps.map(a => `${a.name} (pid=${a.pid})`).join(', ')}`;
  });

  // Test 5: /connect to notepad
  let connectedPid = null;
  await test('5. /connect to notepad', async () => {
    const findResult = await post('/find', { query: 'notepad' });
    if (findResult.count === 0) throw new Error('No notepad to connect to');
    const target = findResult.apps[0];
    const data = await post('/connect', { target: target.pid });
    if (!data.connected) throw new Error('Connection failed');
    connectedPid = target.pid;
    return `Connected to pid=${target.pid}, framework=${data.framework || 'unknown'}`;
  });

  // Test 6: /enumerate on connected pid
  await test('6. /enumerate returns elements', async () => {
    if (!connectedPid) throw new Error('No connected PID from previous step');
    const data = await post('/enumerate', { pid: connectedPid });
    if (typeof data.totalElements !== 'number') throw new Error('No totalElements in response');
    if (data.totalElements === 0) throw new Error('Zero elements returned');
    return `${data.totalElements} UI elements found`;
  });

  // Test 7: /disconnect
  await test('7. /disconnect', async () => {
    if (!connectedPid) throw new Error('No connected PID');
    const data = await post('/disconnect', { pid: connectedPid });
    if (!data.disconnected) throw new Error('Disconnect failed');
    return `Disconnected pid=${connectedPid}`;
  });

  // Test 8: Final summary
  await test('8. Overall verification', async () => {
    // Re-check health one more time
    const health = await get('/health');
    if (health.status !== 'ok') throw new Error('Final health check failed');

    const skillPath = findSkillFile();
    if (!skillPath) throw new Error('Skill file not found in final check');

    return 'Server healthy, skill file present';
  });

  // Summary
  console.log('');
  console.log('────────────────────────────────────');
  console.log(`Results: ${passed} PASS, ${failed} FAIL out of 8 tests`);
  console.log('');

  if (failed === 0) {
    console.log('All tests passed. UAB Bridge installation is working.');
  } else {
    console.log('Some tests failed. Check the output above.');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
