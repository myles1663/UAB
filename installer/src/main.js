/**
 * UAB Bridge Installer — Electron Main Process
 *
 * Cross-platform (Windows + macOS). Dual-write to:
 *   1. Claude Code CLI plugins (~/.claude/plugins/)
 *   2. Co-work sessions (%APPDATA%/Claude/local-agent-mode-sessions/ or ~/Library/Application Support/Claude/)
 *
 * Detects host gateway IP, generates API key, binds to 0.0.0.0:3100.
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const os = require('os');

let mainWindow;

// ─── Shared State (computed once at install time) ──────────────

let hostIp = '127.0.0.1';
let apiKey = '';

// ─── Paths ─────────────────────────────────────────────────────

function getUABRoot() {
  if (app.isPackaged) return path.join(process.resourcesPath);
  return path.resolve(__dirname, '..', '..');
}

function getNodePath() {
  const candidates = [];
  if (os.platform() === 'win32') {
    const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
    try {
      const w = execSync('where node', { stdio: 'pipe', shell: 'cmd.exe' }).toString().trim().split('\n')[0].trim();
      if (w && fs.existsSync(w)) candidates.unshift(w);
    } catch {}
    candidates.push(path.join(pf, 'nodejs', 'node.exe'));
    if (process.env.LOCALAPPDATA) candidates.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'nodejs', 'node.exe'));
  } else {
    try {
      const w = execSync('which node', { stdio: 'pipe' }).toString().trim();
      if (w && fs.existsSync(w)) candidates.unshift(w);
    } catch {}
    candidates.push('/usr/local/bin/node', '/opt/homebrew/bin/node', '/usr/bin/node');
  }
  for (const p of candidates) { if (fs.existsSync(p)) return p; }
  return process.execPath;
}

function getCliPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'uab-dist', 'cli.js')
    : path.join(getUABRoot(), 'dist', 'cli.js');
}

// ─── Network Detection ─────────────────────────────────────────

function detectHostGatewayIp() {
  const interfaces = os.networkInterfaces();

  // Pass 1: WSL / Hyper-V adapter
  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    const ln = name.toLowerCase();
    if (ln.includes('wsl') || ln.includes('hyper-v')) {
      for (const a of addrs) {
        if (a.family === 'IPv4' && !a.internal) return { ip: a.address, adapter: name, method: 'wsl' };
      }
    }
  }
  // Pass 2: Any virtual adapter
  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    const ln = name.toLowerCase();
    if (ln.includes('vethernet') || ln.includes('vmnet') || ln.includes('vbox')) {
      for (const a of addrs) {
        if (a.family === 'IPv4' && !a.internal) return { ip: a.address, adapter: name, method: 'vm' };
      }
    }
  }
  // Pass 3: LAN IP
  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    const ln = name.toLowerCase();
    if (ln.includes('vethernet') || ln.includes('vmnet') || ln.includes('docker') || ln.includes('loopback')) continue;
    for (const a of addrs) {
      if (a.family === 'IPv4' && !a.internal) return { ip: a.address, adapter: name, method: 'lan' };
    }
  }
  return { ip: '127.0.0.1', adapter: 'loopback', method: 'fallback' };
}

function getOrCreateApiKey() {
  const keyDir = os.platform() === 'darwin'
    ? path.join(os.homedir(), 'Library', 'Application Support', 'UAB Bridge')
    : path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'UAB Bridge');
  const keyFile = path.join(keyDir, 'api-key');

  if (fs.existsSync(keyFile)) {
    const key = fs.readFileSync(keyFile, 'utf-8').trim();
    if (key.length > 10) return key;
  }

  const key = `uab_${crypto.randomBytes(24).toString('base64url')}`;
  fs.mkdirSync(keyDir, { recursive: true });
  fs.writeFileSync(keyFile, key, 'utf-8');
  return key;
}

// ─── Skill Directory Discovery (CLI + Co-work) ─────────────────

function findAllSkillLocations() {
  const home = os.homedir();
  const result = { cliSkillPath: '', cliPluginRoot: '', coworkPaths: [] };

  // CLI plugin path
  const cliBase = path.join(home, '.claude', 'plugins', 'marketplaces', 'claude-plugins-official', 'plugins', 'uab-bridge');
  result.cliPluginRoot = cliBase;
  result.cliSkillPath = path.join(cliBase, 'skills', 'uab-bridge', 'SKILL.md');

  // Co-work sessions
  let sessionsDir;
  if (os.platform() === 'darwin') {
    sessionsDir = path.join(home, 'Library', 'Application Support', 'Claude', 'local-agent-mode-sessions');
  } else if (os.platform() === 'win32') {
    sessionsDir = path.join(process.env.APPDATA || '', 'Claude', 'local-agent-mode-sessions');
  } else {
    sessionsDir = path.join(process.env.XDG_CONFIG_HOME || path.join(home, '.config'), 'Claude', 'local-agent-mode-sessions');
  }

  if (fs.existsSync(sessionsDir)) {
    try {
      for (const session of fs.readdirSync(sessionsDir, { withFileTypes: true })) {
        if (!session.isDirectory()) continue;
        const sp = path.join(sessionsDir, session.name);
        for (const ws of fs.readdirSync(sp, { withFileTypes: true })) {
          if (!ws.isDirectory()) continue;
          const cp = path.join(sp, ws.name, 'cowork_plugins');
          if (fs.existsSync(cp)) {
            result.coworkPaths.push(
              path.join(cp, 'marketplaces', 'knowledge-work-plugins', 'uab-desktop-control', 'skills', 'uab-bridge')
            );
          }
        }
      }
    } catch {}
  }

  return result;
}

// ─── Skill Content Generation ───────────────────────────────────

function generateSkillMd(version, date, hostIpAddr, key) {
  return `---
name: uab-bridge
description: Use this skill when the user wants to interact with desktop applications, control GUI apps, automate Windows programs, read from or write to Excel/Word/PowerPoint, interact with browser tabs, click buttons, type text into fields, take screenshots of app windows, open applications, or perform any desktop automation task. Provides native control of desktop applications via UAB (Universal App Bridge) running at http://localhost:3100.
---

# UAB — Universal App Bridge

UAB gives you native control of desktop applications on this computer.
It is running on the host machine at http://localhost:3100.

You can reach it from Chrome using JavaScript fetch() or from the
terminal using curl. localhost:3100 is always reachable because
UABServer runs on the same machine as Chrome.

## Authentication

All POST requests MUST include this API key header:
\`\`\`
X-API-Key: ${key}
\`\`\`

GET /health does not require authentication.

## How to Make Requests

Use the Chrome integration to run JavaScript, or use fetch directly.
All endpoints accept POST with JSON body. Always include the API key.

Example using JavaScript in Chrome:
\`\`\`javascript
const UAB = 'http://localhost:3100';
const KEY = '${key}';
const headers = { 'Content-Type': 'application/json', 'X-API-Key': KEY };

// Scan for apps
const scan = await fetch(\`\${UAB}/scan\`, { method: 'POST', headers }).then(r => r.json());

// Find an app
const find = await fetch(\`\${UAB}/find\`, { method: 'POST', headers, body: JSON.stringify({ query: 'notepad' }) }).then(r => r.json());

// Connect
const conn = await fetch(\`\${UAB}/connect\`, { method: 'POST', headers, body: JSON.stringify({ target: 'notepad' }) }).then(r => r.json());

// Enumerate UI elements
const elements = await fetch(\`\${UAB}/enumerate\`, { method: 'POST', headers, body: JSON.stringify({ pid: conn.pid }) }).then(r => r.json());

// Click a button
await fetch(\`\${UAB}/act\`, { method: 'POST', headers, body: JSON.stringify({ pid: conn.pid, elementId: 'btn_1', action: 'click' }) });

// Type text
await fetch(\`\${UAB}/act\`, { method: 'POST', headers, body: JSON.stringify({ pid: conn.pid, elementId: 'input_1', action: 'type', params: { text: 'Hello World' } }) });
\`\`\`

If localhost doesn't work (e.g., from a VM), try http://${hostIpAddr}:3100 instead.

## API Reference

### Discovery
- \`POST /scan\` — List all running applications with GUI windows
- \`POST /find\` — Find apps by name: \`{ "query": "excel" }\`
- \`POST /connect\` — Connect to an app: \`{ "target": "excel" }\` or \`{ "target": 1234 }\`
- \`POST /disconnect\` — Disconnect: \`{ "pid": 1234 }\`

### UI Interaction
- \`POST /enumerate\` — List UI elements: \`{ "pid": 1234 }\`
- \`POST /query\` — Find specific elements: \`{ "pid": 1234, "selector": { "type": "button", "name": "Save" } }\`
- \`POST /act\` — Perform action: \`{ "pid": 1234, "elementId": "btn_1", "action": "click" }\`
  - Actions: click, type, focus, select, expand, collapse, scroll
  - For type: \`{ "action": "type", "params": { "text": "Hello" } }\`
- \`POST /state\` — Get app state: \`{ "pid": 1234 }\`

### Input
- \`POST /keypress\` — Keyboard shortcut: \`{ "pid": 1234, "key": "ctrl+s" }\`
- \`POST /hotkey\` — Multi-key combo: \`{ "pid": 1234, "keys": ["ctrl", "shift", "s"] }\`

### Media
- \`POST /screenshot\` — Screenshot (base64 PNG): \`{ "pid": 1234 }\`

### Health
- \`GET /health\` — Server status (no auth required)

## Typical Workflow

1. \`/scan\` or \`/find\` to discover the app
2. \`/connect\` with the pid or name
3. \`/enumerate\` to see UI elements
4. \`/query\` to find specific elements
5. \`/act\` to interact (click, type, etc.)
6. \`/disconnect\` when done

## Supported Applications

- Microsoft Office (Excel, Word, PowerPoint) — COM control
- Chrome, Edge, Brave — Chrome DevTools Protocol via extension
- Electron apps (VS Code, Slack, Discord, Teams) — CDP
- Qt apps (VLC, Telegram, OBS) — UI Automation
- Any Windows/macOS application — UI Automation fallback

## Important Notes

- Always \`/connect\` before using \`/enumerate\`, \`/query\`, \`/act\`, or \`/state\`
- Always include the \`X-API-Key\` header in every POST request
- UAB runs on localhost — it is always reachable from Chrome
- If a connection fails, try \`/scan\` first to refresh the process list
`;
}

// ─── Window ────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 560,
    height: 480,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    title: 'UAB Bridge Installer',
    backgroundColor: '#0F0A1A',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());

// ─── IPC Handlers ──────────────────────────────────────────────

/**
 * Step 1: Check system requirements + detect network + generate API key
 */
ipcMain.handle('check-requirements', async () => {
  const results = { nodeVersion: null, port: null, os: null, errors: [], hostIp: null, apiKey: null };

  const ver = process.versions.node;
  const major = parseInt(ver.split('.')[0], 10);
  results.nodeVersion = ver;
  if (major < 18) results.errors.push(`Node.js ${ver} found, but >= 18 required.`);

  results.port = await checkPort(3100);

  const platform = os.platform();
  const release = os.release();
  results.os = `${platform} ${release}`;

  if (platform === 'win32') {
    if (parseInt(release.split('.')[0], 10) < 10) results.errors.push('Windows 10 or later required.');
  } else if (platform === 'darwin') {
    if (parseInt(release.split('.')[0], 10) < 21) results.errors.push('macOS 12 (Monterey) or later required.');
  }

  // Detect network + API key (shared across all steps)
  const net = detectHostGatewayIp();
  hostIp = net.ip;
  apiKey = getOrCreateApiKey();
  results.hostIp = hostIp;
  results.apiKey = '(generated)';

  return results;
});

/**
 * Step 2: Install daemon (0.0.0.0 + API key)
 */
ipcMain.handle('install-daemon', async () => {
  const result = { installed: false, running: false, error: null };

  // Enable CDP for all Electron apps (ChatGPT, VS Code, Slack, etc.)
  enableElectronDebugging();

  try {
    const running = await checkHealth();
    if (running) { result.installed = true; result.running = true; return result; }

    const nodePath = getNodePath();
    const cliPath = getCliPath();
    const installDir = app.isPackaged ? process.resourcesPath : getUABRoot();

    if (os.platform() === 'win32') {
      const command = `"${nodePath}" "${cliPath}" serve --host 0.0.0.0 --port 3100 --api-key ${apiKey}`;
      const username = os.userInfo().username;
      execSync(`schtasks /create /tn "UAB Bridge" /tr "${command}" /sc ONLOGON /ru "${username}" /f`, { stdio: 'pipe', shell: 'cmd.exe' });
      execSync(`schtasks /run /tn "UAB Bridge"`, { stdio: 'pipe', shell: 'cmd.exe' });
    } else if (os.platform() === 'darwin') {
      const logDir = path.join(os.homedir(), 'Library', 'Logs', 'UAB Bridge');
      fs.mkdirSync(logDir, { recursive: true });
      const agentsDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
      fs.mkdirSync(agentsDir, { recursive: true });
      const plistPath = path.join(agentsDir, 'com.lancelot.uab-bridge.plist');

      const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.lancelot.uab-bridge</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${cliPath}</string>
    <string>serve</string>
    <string>--host</string>
    <string>0.0.0.0</string>
    <string>--port</string>
    <string>3100</string>
    <string>--api-key</string>
    <string>${apiKey}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${logDir}/uab-bridge.log</string>
  <key>StandardErrorPath</key>
  <string>${logDir}/uab-bridge-error.log</string>
  <key>WorkingDirectory</key>
  <string>${installDir}</string>
</dict>
</plist>`;
      fs.writeFileSync(plistPath, plist, 'utf-8');
      execSync(`launchctl load "${plistPath}"`, { stdio: 'pipe' });
      execSync('launchctl start com.lancelot.uab-bridge', { stdio: 'pipe' });
    }

    result.installed = true;
    for (let i = 0; i < 10; i++) {
      await sleep(500);
      if (await checkHealth()) { result.running = true; break; }
    }
    return result;
  } catch (err) {
    result.error = err.message || String(err);
    return result;
  }
});

/**
 * Step 3: Install Chrome extension
 */
ipcMain.handle('install-extension', async () => {
  const uabRoot = getUABRoot();
  const result = { registered: false, browsers: [], error: null };

  try {
    const dataDir = app.isPackaged ? path.join(process.resourcesPath, 'uab-data') : path.join(uabRoot, 'data');
    const crxPath = path.join(dataDir, 'uab-bridge.crx');
    const idPath = path.join(dataDir, 'extension-id.txt');

    if (!fs.existsSync(crxPath)) {
      try {
        const scriptPath = app.isPackaged
          ? path.join(process.resourcesPath, 'uab-scripts', 'pack-extension.js')
          : path.join(uabRoot, 'scripts', 'pack-extension.js');
        execSync(`"${getNodePath()}" "${scriptPath}"`, { stdio: 'pipe', cwd: app.isPackaged ? process.resourcesPath : uabRoot });
      } catch (e) {
        result.error = 'Could not pack extension: ' + (e.message || String(e));
        return result;
      }
    }

    if (!fs.existsSync(idPath)) { result.error = 'Extension ID not found.'; return result; }

    const extensionId = fs.readFileSync(idPath, 'utf-8').trim();
    const manifestPath = path.join(dataDir, 'chrome-extension', 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    const version = manifest.version || '1.0.0';
    const absCrxPath = path.resolve(crxPath);
    const browsers = detectBrowsers();
    result.browsers = browsers;

    if (os.platform() === 'win32') {
      for (const [browser, regPath] of [
        ['Chrome', `HKCU\\SOFTWARE\\Google\\Chrome\\Extensions\\${extensionId}`],
        ['Edge', `HKCU\\SOFTWARE\\Microsoft\\Edge\\Extensions\\${extensionId}`],
      ]) {
        if (browsers.includes(browser)) {
          try {
            execSync(`reg add "${regPath}" /v path /t REG_SZ /d "${absCrxPath}" /f`, { stdio: 'pipe', shell: 'cmd.exe' });
            execSync(`reg add "${regPath}" /v version /t REG_SZ /d "${version}" /f`, { stdio: 'pipe', shell: 'cmd.exe' });
          } catch {}
        }
      }
    } else if (os.platform() === 'darwin') {
      const extJson = JSON.stringify({ external_crx: absCrxPath, external_version: version }, null, 2);
      for (const [browser, dirName] of [['Chrome', 'Google/Chrome'], ['Edge', 'Microsoft Edge']]) {
        if (browsers.includes(browser)) {
          const dir = path.join(os.homedir(), 'Library', 'Application Support', dirName, 'External Extensions');
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, `${extensionId}.json`), extJson, 'utf-8');
        }
      }
    }

    result.registered = browsers.length > 0;
    return result;
  } catch (err) {
    result.error = err.message || String(err);
    return result;
  }
});

/**
 * Step 4: Detect ALL skill locations (CLI + Co-work)
 */
ipcMain.handle('detect-skills-dir', async () => {
  const locations = findAllSkillLocations();
  // Ensure CLI directory exists
  fs.mkdirSync(path.dirname(locations.cliSkillPath), { recursive: true });
  return locations;
});

/**
 * Step 5: Write skill to ALL locations + register plugin
 */
ipcMain.handle('write-skill-file', async (event, locations) => {
  try {
    const pkg = app.isPackaged
      ? JSON.parse(fs.readFileSync(path.join(process.resourcesPath, 'uab-package.json'), 'utf-8'))
      : JSON.parse(fs.readFileSync(path.join(getUABRoot(), 'package.json'), 'utf-8'));
    const version = pkg.version || '0.9.0';
    const date = new Date().toISOString().split('T')[0];

    const content = generateSkillMd(version, date, hostIp, apiKey);
    let cliOk = false;
    let coworkCount = 0;

    // Write to CLI plugin directory
    try {
      fs.mkdirSync(path.dirname(locations.cliSkillPath), { recursive: true });
      fs.writeFileSync(locations.cliSkillPath, content, 'utf-8');
      cliOk = fs.existsSync(locations.cliSkillPath);
    } catch (err) {
      console.error('CLI skill write failed:', err.message);
    }

    // Write to ALL Co-work session directories
    for (const coworkDir of (locations.coworkPaths || [])) {
      try {
        fs.mkdirSync(coworkDir, { recursive: true });
        fs.writeFileSync(path.join(coworkDir, 'SKILL.md'), content, 'utf-8');
        // Write README in plugin root
        const pluginRoot = path.join(coworkDir, '..', '..');
        const readme = '# UAB Desktop Control\n\nGives Claude native control of desktop applications via the Universal App Bridge.\n';
        if (!fs.existsSync(path.join(pluginRoot, 'README.md'))) {
          fs.writeFileSync(path.join(pluginRoot, 'README.md'), readme, 'utf-8');
        }
        coworkCount++;
      } catch (err) {
        console.error('Co-work skill write failed:', err.message);
      }
    }

    // Register in Claude Code CLI settings
    if (cliOk) registerPluginInSettings();

    return { success: cliOk || coworkCount > 0, cliOk, coworkCount, path: locations.cliSkillPath };
  } catch (err) {
    return { success: false, error: err.message || String(err) };
  }
});

/**
 * Step 6: Verify installation
 */
ipcMain.handle('verify-install', async (event, skillFilePath) => {
  return {
    serverHealthy: await checkHealth(),
    skillFileExists: fs.existsSync(skillFilePath),
  };
});

// ─── Helpers ───────────────────────────────────────────────────

function checkPort(port) {
  return new Promise((resolve) => {
    const server = require('net').createServer();
    server.once('error', () => resolve({ available: false, note: 'Port may be in use (UAB might already be running)' }));
    server.once('listening', () => { server.close(); resolve({ available: true }); });
    server.listen(port, '127.0.0.1');
  });
}

function checkHealth() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:3100/health', { timeout: 500 }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => { try { resolve(JSON.parse(data).status === 'ok'); } catch { resolve(false); } });
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function detectBrowsers() {
  const browsers = [];
  if (os.platform() === 'win32') {
    const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
    const pfx = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const la = process.env.LOCALAPPDATA || '';
    if ([path.join(pf, 'Google/Chrome/Application/chrome.exe'), path.join(pfx, 'Google/Chrome/Application/chrome.exe'), path.join(la, 'Google/Chrome/Application/chrome.exe')].some(p => fs.existsSync(p))) browsers.push('Chrome');
    if ([path.join(pf, 'Microsoft/Edge/Application/msedge.exe'), path.join(pfx, 'Microsoft/Edge/Application/msedge.exe')].some(p => fs.existsSync(p))) browsers.push('Edge');
    if ([path.join(pf, 'BraveSoftware/Brave-Browser/Application/brave.exe'), path.join(pfx, 'BraveSoftware/Brave-Browser/Application/brave.exe'), path.join(la, 'BraveSoftware/Brave-Browser/Application/brave.exe')].some(p => fs.existsSync(p))) browsers.push('Brave');
  } else if (os.platform() === 'darwin') {
    if (fs.existsSync('/Applications/Google Chrome.app')) browsers.push('Chrome');
    if (fs.existsSync('/Applications/Microsoft Edge.app')) browsers.push('Edge');
    if (fs.existsSync('/Applications/Brave Browser.app')) browsers.push('Brave');
  }
  return browsers;
}

function enableElectronDebugging() {
  const varName = 'ELECTRON_ENABLE_REMOTE_DEBUGGING';
  try {
    if (os.platform() === 'win32') {
      // Check if already set
      try {
        const r = execSync(`reg query "HKCU\\Environment" /v ${varName}`, { stdio: 'pipe', shell: 'cmd.exe' }).toString();
        if (r.includes('1')) return; // Already enabled
      } catch {}
      execSync(`setx ${varName} 1`, { stdio: 'pipe', shell: 'cmd.exe' });
    } else if (os.platform() === 'darwin') {
      try { execSync(`launchctl setenv ${varName} 1`, { stdio: 'pipe' }); } catch {}
      const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', 'com.lancelot.uab-electron-debug.plist');
      if (!fs.existsSync(plistPath)) {
        const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.lancelot.uab-electron-debug</string>
  <key>ProgramArguments</key><array><string>/bin/launchctl</string><string>setenv</string><string>${varName}</string><string>1</string></array>
  <key>RunAtLoad</key><true/>
</dict></plist>`;
        fs.mkdirSync(path.dirname(plistPath), { recursive: true });
        fs.writeFileSync(plistPath, plist, 'utf-8');
        try { execSync(`launchctl load "${plistPath}"`, { stdio: 'pipe' }); } catch {}
      }
    }
  } catch (err) {
    console.error('Could not enable Electron debugging:', err.message);
  }
}

function registerPluginInSettings() {
  const home = os.homedir();
  const claudeDir = path.join(home, '.claude');
  const pluginsDir = path.join(claudeDir, 'plugins');
  const pluginKey = 'uab-bridge@claude-plugins-official';

  try {
    const installedPath = path.join(pluginsDir, 'installed_plugins.json');
    let installed = { version: 2, plugins: {} };
    if (fs.existsSync(installedPath)) { try { installed = JSON.parse(fs.readFileSync(installedPath, 'utf-8')); } catch {} }
    else { fs.mkdirSync(pluginsDir, { recursive: true }); }

    if (!(installed.plugins || {})[pluginKey]) {
      const plugins = installed.plugins || {};
      plugins[pluginKey] = [{ scope: 'user', installPath: path.join(pluginsDir, 'marketplaces', 'claude-plugins-official', 'plugins', 'uab-bridge'), version: 'local', installedAt: new Date().toISOString(), lastUpdated: new Date().toISOString() }];
      installed.plugins = plugins;
      fs.writeFileSync(installedPath, JSON.stringify(installed, null, 2), 'utf-8');
    }

    const settingsPath = path.join(claudeDir, 'settings.json');
    let settings = {};
    if (fs.existsSync(settingsPath)) { try { settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8')); } catch {} }
    const enabled = settings.enabledPlugins || {};
    if (!enabled[pluginKey]) { enabled[pluginKey] = true; settings.enabledPlugins = enabled; fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8'); }
  } catch (err) {
    console.error('Plugin registration warning:', err.message);
  }
}
