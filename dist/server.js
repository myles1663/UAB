/**
 * UAB HTTP Server — Server-side endpoint for remote UAB access.
 *
 * Wraps UABConnector in a lightweight HTTP server so agents running
 * on a different machine (or in a container) can control desktop apps
 * on the host via REST calls.
 *
 * Architecture:
 *   - Uses Node's built-in `http` module (ZERO dependencies)
 *   - Each request gets its own context (stateless by default)
 *   - Shared UABConnector instance with connection pooling
 *   - JSON request/response only
 *   - Localhost-only by default (security)
 *
 * Usage:
 *   import { UABServer } from './server.js';
 *   const server = new UABServer({ port: 3100 });
 *   await server.start();
 *   // Clients: POST http://localhost:3100/scan
 *   //          POST http://localhost:3100/connect { "target": "notepad" }
 *   //          POST http://localhost:3100/query { "pid": 1234, "selector": { "type": "button" } }
 *   await server.stop();
 *
 * @example
 * ```bash
 * # From any HTTP client / agent:
 * curl -X POST http://localhost:3100/scan
 * curl -X POST http://localhost:3100/connect -d '{"target":"notepad"}'
 * curl -X POST http://localhost:3100/query -d '{"pid":1234,"selector":{"type":"button"}}'
 * curl -X POST http://localhost:3100/act -d '{"pid":1234,"elementId":"btn_1","action":"click"}'
 * ```
 */
import { createServer } from 'http';
import { UABConnector } from './connector.js';
import { detectEnvironment, getDefaults } from './environment.js';
// ─── Server ───────────────────────────────────────────────────
export class UABServer {
    server = null;
    connector;
    routes;
    opts;
    environment;
    constructor(options) {
        this.environment = detectEnvironment();
        const defaults = getDefaults(this.environment.mode);
        this.opts = {
            port: options?.port ?? 3100,
            host: options?.host ?? '127.0.0.1',
            apiKey: options?.apiKey,
            maxBodySize: options?.maxBodySize ?? 1024 * 1024, // 1MB
        };
        // Merge environment defaults with user overrides
        this.connector = new UABConnector({
            persistent: defaults.persistent,
            extensionBridge: defaults.extensionBridge,
            rateLimit: defaults.rateLimit,
            ...options?.connector,
        });
        this.routes = new Map();
        this.registerRoutes();
    }
    // ─── Lifecycle ──────────────────────────────────────────────
    async start() {
        await this.connector.start();
        return new Promise((resolve, reject) => {
            this.server = createServer((req, res) => this.handleRequest(req, res));
            this.server.on('error', reject);
            this.server.listen(this.opts.port, this.opts.host, () => {
                resolve();
            });
        });
    }
    async stop() {
        await this.connector.stop();
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => resolve());
            }
            else {
                resolve();
            }
        });
    }
    get running() {
        return this.server?.listening ?? false;
    }
    get address() {
        return `http://${this.opts.host}:${this.opts.port}`;
    }
    // ─── Request Handling ───────────────────────────────────────
    async handleRequest(req, res) {
        // CORS headers for browser-based agents
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }
        // Parse route early — /health is exempt from auth
        const path = (req.url || '/').replace(/\/$/, '') || '/';
        // GET /health is always accessible (used by daemon health checks)
        if (req.method === 'GET' && path === '/health') {
            this.sendJSON(res, 200, {
                status: 'ok',
                version: '1.0.0',
                environment: this.environment,
                connector: this.connector.running,
                uptime: Math.floor(process.uptime()),
            });
            return;
        }
        // GET /flow/{appname} — lookup pre-built flow for an app (public, no auth)
        if (req.method === 'GET' && path.startsWith('/flow/')) {
            const appName = path.substring(6).toLowerCase().replace(/[^a-z0-9_-]/g, '');
            const { existsSync: flowExists, readFileSync: flowRead, readdirSync: flowDir } = await import('fs');
            const { resolve: flowResolve, join: flowJoin } = await import('path');
            const libDir = flowResolve('data/flow-library');
            if (appName === '' || appName === 'list') {
                // List all available flows
                try {
                    const files = flowDir(libDir).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
                    const flows = files.map((f) => {
                        const data = JSON.parse(flowRead(flowJoin(libDir, f), 'utf-8'));
                        return { app: f.replace('.json', ''), name: data.skill_name, framework: data.app_framework, version: data.version };
                    });
                    this.sendJSON(res, 200, { flows });
                }
                catch {
                    this.sendJSON(res, 200, { flows: [] });
                }
                return;
            }
            // Look for exact match first, then fuzzy match
            let flowPath = flowJoin(libDir, `${appName}.json`);
            if (!flowExists(flowPath)) {
                // Fuzzy: check if any file contains the app name
                try {
                    const files = flowDir(libDir).filter((f) => f.endsWith('.json') && !f.startsWith('_'));
                    const match = files.find((f) => f.includes(appName) || appName.includes(f.replace('.json', '')));
                    if (match)
                        flowPath = flowJoin(libDir, match);
                }
                catch { }
            }
            if (flowExists(flowPath)) {
                try {
                    const flow = JSON.parse(flowRead(flowPath, 'utf-8'));
                    this.sendJSON(res, 200, flow);
                }
                catch {
                    this.sendError(res, 500, 'Failed to parse flow file');
                }
            }
            else {
                // Return default based on framework if we can detect it
                const defaultsPath = flowJoin(libDir, '_defaults.json');
                if (flowExists(defaultsPath)) {
                    const defaults = JSON.parse(flowRead(defaultsPath, 'utf-8'));
                    this.sendJSON(res, 200, {
                        skill_name: `${appName}_default_flow`,
                        app_name: appName,
                        app_framework: 'unknown',
                        target_flow: `Default interaction flow for ${appName}`,
                        ...defaults.frameworks['unknown'],
                        note: 'No app-specific flow found. Using default template. After successful interaction, save the working flow via POST /flow.',
                    });
                }
                else {
                    this.sendError(res, 404, `No flow found for "${appName}". GET /flow/list for available flows.`);
                }
            }
            return;
        }
        // GET /info is public (agents need to discover endpoints)
        if (req.method === 'GET' && path === '/info') {
            this.sendJSON(res, 200, {
                name: 'Universal App Bridge Server',
                version: '1.0.0',
                environment: this.environment,
                endpoints: [...this.routes.keys()].map(r => `POST ${r}`),
            });
            return;
        }
        // Auth check (all other endpoints)
        if (this.opts.apiKey) {
            const provided = req.headers['x-api-key'];
            if (provided !== this.opts.apiKey) {
                this.sendError(res, 401, 'Invalid or missing API key');
                return;
            }
        }
        // All other routes are POST
        if (req.method !== 'POST') {
            this.sendError(res, 405, 'Method not allowed. Use POST for API calls, GET for /health and /info.');
            return;
        }
        const handler = this.routes.get(path);
        if (!handler) {
            this.sendError(res, 404, `Unknown endpoint: ${path}. GET /info for available endpoints.`);
            return;
        }
        // Parse body
        let body;
        try {
            body = await this.readBody(req);
        }
        catch (err) {
            this.sendError(res, 400, err instanceof Error ? err.message : 'Invalid request body');
            return;
        }
        // Execute
        try {
            const result = await handler(body, this.connector);
            this.sendJSON(res, 200, result);
        }
        catch (err) {
            this.sendError(res, 500, err instanceof Error ? err.message : 'Internal server error');
        }
    }
    async readBody(req) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            let size = 0;
            req.on('data', (chunk) => {
                size += chunk.length;
                if (size > this.opts.maxBodySize) {
                    req.destroy();
                    reject(new Error(`Request body exceeds ${this.opts.maxBodySize} bytes`));
                    return;
                }
                chunks.push(chunk);
            });
            req.on('end', () => {
                const raw = Buffer.concat(chunks).toString('utf-8').trim();
                if (!raw) {
                    resolve({});
                    return;
                }
                try {
                    const parsed = JSON.parse(raw);
                    if (typeof parsed !== 'object' || parsed === null) {
                        reject(new Error('Request body must be a JSON object'));
                        return;
                    }
                    resolve(parsed);
                }
                catch {
                    reject(new Error('Invalid JSON in request body'));
                }
            });
            req.on('error', reject);
        });
    }
    sendJSON(res, status, data) {
        const body = JSON.stringify(data, null, 2);
        res.writeHead(status);
        res.end(body);
    }
    sendError(res, status, message) {
        this.sendJSON(res, status, { error: message });
    }
    // ─── Route Registration ─────────────────────────────────────
    registerRoutes() {
        // Discovery
        this.routes.set('/scan', async (_body, conn) => {
            const electronOnly = _body.electronOnly === true;
            const profiles = await conn.scan(electronOnly);
            return {
                count: profiles.length,
                apps: profiles.map(p => ({
                    pid: p.pid, name: p.name, executable: p.executable,
                    framework: p.framework, confidence: p.confidence,
                    windowTitle: p.windowTitle,
                })),
            };
        });
        this.routes.set('/apps', async (_body, conn) => {
            const profiles = conn.apps();
            const framework = _body.framework;
            const filtered = framework
                ? profiles.filter(p => p.framework === framework)
                : profiles;
            return {
                count: filtered.length,
                apps: filtered.map(p => ({
                    pid: p.pid, name: p.name, executable: p.executable,
                    framework: p.framework, preferredMethod: p.preferredMethod,
                })),
            };
        });
        this.routes.set('/find', async (body, conn) => {
            const query = body.query;
            if (!query)
                throw new Error('Missing required field: query');
            const profiles = await conn.find(query);
            return {
                query,
                count: profiles.length,
                apps: profiles.map(p => ({
                    pid: p.pid, name: p.name, executable: p.executable,
                    framework: p.framework, confidence: p.confidence,
                })),
            };
        });
        // Connection
        this.routes.set('/connect', async (body, conn) => {
            const target = body.target;
            if (target === undefined)
                throw new Error('Missing required field: target (name or PID)');
            const pid = typeof target === 'string' ? parseInt(target, 10) : target;
            const info = !isNaN(pid)
                ? await conn.connect(pid)
                : await conn.connect(target);
            return { connected: true, ...info };
        });
        this.routes.set('/disconnect', async (body, conn) => {
            const pid = body.pid;
            if (!pid)
                throw new Error('Missing required field: pid');
            await conn.disconnect(pid);
            return { disconnected: true, pid };
        });
        // UI Interaction
        this.routes.set('/enumerate', async (body, conn) => {
            const pid = body.pid;
            if (!pid)
                throw new Error('Missing required field: pid');
            const maxDepth = body.maxDepth || 3;
            if (!conn.isConnected(pid))
                await conn.connect(pid);
            const elements = await conn.enumerate(pid, maxDepth);
            return {
                pid,
                totalElements: conn.countElements(elements),
                elements: conn.flattenTree(elements, maxDepth),
            };
        });
        this.routes.set('/query', async (body, conn) => {
            const pid = body.pid;
            const selector = body.selector;
            if (!pid)
                throw new Error('Missing required field: pid');
            if (!conn.isConnected(pid))
                await conn.connect(pid);
            const results = await conn.query(pid, selector || {});
            return {
                pid,
                count: results.length,
                elements: results.map(el => ({
                    id: el.id, type: el.type, label: el.label,
                    actions: el.actions, visible: el.visible, enabled: el.enabled,
                })),
            };
        });
        this.routes.set('/act', async (body, conn) => {
            const pid = body.pid;
            const elementId = body.elementId || '';
            const action = body.action;
            if (!pid || !action)
                throw new Error('Missing required fields: pid, action');
            if (!conn.isConnected(pid))
                await conn.connect(pid);
            const result = await conn.act(pid, elementId, action, body.params);
            return { pid, elementId, action, ...result };
        });
        this.routes.set('/state', async (body, conn) => {
            const pid = body.pid;
            if (!pid)
                throw new Error('Missing required field: pid');
            if (!conn.isConnected(pid))
                await conn.connect(pid);
            const state = await conn.state(pid);
            return { pid, ...state };
        });
        // Keyboard & Window
        this.routes.set('/keypress', async (body, conn) => {
            const pid = body.pid;
            const key = body.key;
            if (!pid || !key)
                throw new Error('Missing required fields: pid, key');
            if (!conn.isConnected(pid))
                await conn.connect(pid);
            const result = await conn.keypress(pid, key);
            return { pid, key, ...result };
        });
        this.routes.set('/hotkey', async (body, conn) => {
            const pid = body.pid;
            const keys = body.keys;
            if (!pid || !keys)
                throw new Error('Missing required fields: pid, keys');
            if (!conn.isConnected(pid))
                await conn.connect(pid);
            const result = await conn.hotkey(pid, keys);
            return { pid, keys, ...result };
        });
        this.routes.set('/window', async (body, conn) => {
            const pid = body.pid;
            const action = body.action;
            if (!pid || !action)
                throw new Error('Missing required fields: pid, action');
            if (!conn.isConnected(pid))
                await conn.connect(pid);
            const result = await conn.window(pid, action, body.params);
            return { pid, action, ...result };
        });
        // P6 — OS raw input injection: drag along a coordinate path
        this.routes.set('/drag', async (body) => {
            const pid = body.pid;
            const path = body.path;
            const stepDelay = body.stepDelay || 10;
            const button = body.button || 'left';
            if (!pid)
                throw new Error('Missing required field: pid');
            if (!path || !Array.isArray(path) || path.length < 2) {
                throw new Error('Missing required field: path (array of {x,y} with at least 2 points)');
            }
            const { dragPath } = await import('./plugins/vision/input.js');
            const result = dragPath(pid, path, stepDelay, button);
            return { pid, ...result };
        });
        // P6 — OS raw input injection: scroll at coordinates
        this.routes.set('/scroll', async (body) => {
            const pid = body.pid;
            const x = body.x;
            const y = body.y;
            const amount = body.amount;
            if (!pid || x === undefined || y === undefined || amount === undefined) {
                throw new Error('Missing required fields: pid, x, y, amount');
            }
            const { scrollAt } = await import('./plugins/vision/input.js');
            const result = scrollAt(pid, x, y, amount);
            return { pid, ...result };
        });
        this.routes.set('/screenshot', async (body, conn) => {
            const pid = body.pid;
            if (!pid)
                throw new Error('Missing required field: pid');
            if (!conn.isConnected(pid))
                await conn.connect(pid);
            const result = await conn.screenshot(pid, body.outputPath);
            return { pid, ...result };
        });
        // Deep query — find ALL named/actionable elements in an app via UIA FindAll
        this.routes.set('/deep-query', async (body) => {
            const pid = body.pid;
            const nameFilter = body.name || '';
            const typeFilter = body.type || '';
            if (!pid)
                throw new Error('Missing required field: pid');
            const { runPSRawInteractive } = await import('./ps-exec.js');
            const script = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$rootEl = [System.Windows.Automation.AutomationElement]::RootElement
$procCond = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::ProcessIdProperty, ${pid}
)
$win = $rootEl.FindFirst([System.Windows.Automation.TreeScope]::Children, $procCond)
if (-not $win) { Write-Output '[]'; exit }

$walker = [System.Windows.Automation.TreeWalker]::RawViewWalker
$results = @()
$stack = New-Object System.Collections.Stack
$ch = $walker.GetFirstChild($win)
while ($ch -or $stack.Count -gt 0) {
  if ($ch) {
    try {
      $rawName = $ch.Current.Name
      $name = if ($rawName) { $rawName -replace '[^\\x20-\\x7E]', '' } else { '' }
      $controlType = $ch.Current.ControlType.ProgrammaticName -replace 'ControlType\\\\.', ''
      $rawId = $ch.Current.AutomationId
      $automationId = if ($rawId) { $rawId -replace '[^\\x20-\\x7E]', '' } else { '' }
      $rect = $ch.Current.BoundingRectangle

      $patterns = @()
      try {
        foreach ($p in $ch.GetSupportedPatterns()) {
          $pName = $p.ProgrammaticName -replace 'Identifiers\\\\.Pattern', '' -replace 'PatternIdentifiers\\\\.Pattern', ''
          $patterns += $pName
        }
      } catch {}

      if ($name -or $automationId) {
        $results += @{
          name = $name
          type = $controlType
          id = $automationId
          actions = ($patterns -join ',')
          x = if ($rect.X -gt -99999 -and $rect.X -lt 99999) { [int]$rect.X } else { 0 }
          y = if ($rect.Y -gt -99999 -and $rect.Y -lt 99999) { [int]$rect.Y } else { 0 }
          w = if ($rect.Width -gt 0 -and $rect.Width -lt 99999) { [int]$rect.Width } else { 0 }
          h = if ($rect.Height -gt 0 -and $rect.Height -lt 99999) { [int]$rect.Height } else { 0 }
        }
      }
    } catch {}
    $stack.Push($ch)
    $ch = $walker.GetFirstChild($ch)
  } else {
    $parent = $stack.Pop()
    $ch = $walker.GetNextSibling($parent)
  }
}

$results | ConvertTo-Json -Compress -Depth 2
`;
            try {
                const raw = runPSRawInteractive(script, 30000);
                let elements = JSON.parse(raw);
                if (!Array.isArray(elements))
                    elements = [elements];
                // Apply filters
                if (nameFilter) {
                    const lower = nameFilter.toLowerCase();
                    elements = elements.filter((e) => e.name && e.name.toLowerCase().includes(lower));
                }
                if (typeFilter) {
                    const lower = typeFilter.toLowerCase();
                    elements = elements.filter((e) => e.type && e.type.toLowerCase().includes(lower));
                }
                return { pid, count: elements.length, elements };
            }
            catch (err) {
                throw new Error(`Deep query failed: ${err instanceof Error ? err.message : err}`);
            }
        });
        // Invoke — find a named element and invoke it directly (click/activate)
        this.routes.set('/invoke', async (body) => {
            const pid = body.pid;
            const name = body.name;
            const occurrence = body.occurrence || 'last';
            const setText = body.text || '';
            if (!pid || !name)
                throw new Error('Missing required fields: pid, name');
            const { runPSRawInteractive } = await import('./ps-exec.js');
            const escapedName = name.replace(/'/g, "''");
            const escapedText = setText.replace(/'/g, "''");
            const script = `
$setTextValue = '${escapedText}'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms

$rootEl = [System.Windows.Automation.AutomationElement]::RootElement
$procCond = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::ProcessIdProperty, ${pid}
)
$win = $rootEl.FindFirst([System.Windows.Automation.TreeScope]::Children, $procCond)
if (-not $win) { Write-Output '{"success":false,"error":"window not found"}'; exit }

$nameCond = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::NameProperty, '${escapedName}'
)
$matches = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, $nameCond)

if ($matches.Count -eq 0) {
  Write-Output '{"success":false,"error":"no elements named ${escapedName} found","count":0}'
  exit
}

# Select which occurrence
$target = $null
$occurrence = '${occurrence}'
if ($occurrence -eq 'last') {
  $maxY = -999999
  foreach ($el in $matches) {
    $y = $el.Current.BoundingRectangle.Y
    if ($y -gt $maxY) { $maxY = $y; $target = $el }
  }
} elseif ($occurrence -eq 'first') {
  $minY = 999999
  foreach ($el in $matches) {
    $y = $el.Current.BoundingRectangle.Y
    if ($y -lt $minY) { $minY = $y; $target = $el }
  }
} else {
  $idx = [int]$occurrence
  if ($idx -lt $matches.Count) { $target = $matches[$idx] }
}

if (-not $target) {
  Write-Output '{"success":false,"error":"occurrence not found","count":' + $matches.Count + '}'
  exit
}

# Try to invoke or set focus
try {
  $invoked = $false
  try {
    $invokePattern = $target.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
    $invokePattern.Invoke()
    $invoked = $true
  } catch {}

  if (-not $invoked) {
    try {
      $target.SetFocus()
      $invoked = $true
    } catch {}
  }

  if (-not $invoked) {
    try {
      $valuePattern = $target.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
      if ($setTextValue) {
        $valuePattern.SetValue($setTextValue)
      } else {
        $valuePattern.SetValue('')
      }
      $invoked = $true
    } catch {}
  }

  if (-not $invoked) {
    try {
      $expandPattern = $target.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern)
      $expandPattern.Expand()
      $invoked = $true
    } catch {}
  }

  if (-not $invoked) { throw [System.Exception]::new("No supported pattern (Invoke, Focus, Value, or ExpandCollapse)") }

  Start-Sleep -Milliseconds 500

  $clipRaw = [System.Windows.Forms.Clipboard]::GetText()

  $rect = $target.Current.BoundingRectangle
  $result = @{
    success = $true
    name = ($target.Current.Name -replace '[^\\x20-\\x7E]', '')
    type = $target.Current.ControlType.ProgrammaticName
    totalMatches = $matches.Count
    x = if ($rect.X -gt -99999 -and $rect.X -lt 99999) { [int]$rect.X } else { 0 }
    y = if ($rect.Y -gt -99999 -and $rect.Y -lt 99999) { [int]$rect.Y } else { 0 }
    clipboardLength = $clipRaw.Length
    clipboardText = if ($clipRaw.Length -gt 0) { $clipRaw -replace '[^\\x20-\\x7E\\r\\n]', '' } else { '' }
  }
  $result | ConvertTo-Json -Compress -Depth 2
} catch {
  @{
    success = $false
    error = ($_.Exception.Message -replace '[^\\x20-\\x7E]', '')
    totalMatches = if ($matches) { $matches.Count } else { 0 }
  } | ConvertTo-Json -Compress
}
`;
            try {
                const raw = runPSRawInteractive(script, 20000);
                return JSON.parse(raw);
            }
            catch (err) {
                throw new Error(`Invoke failed: ${err instanceof Error ? err.message : err}`);
            }
        });
        // Save/update a flow in the library
        this.routes.set('/flow', async (body) => {
            const appName = (body.app_name || body.skill_name || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
            if (!appName)
                throw new Error('Missing required field: app_name');
            const { writeFileSync, mkdirSync } = await import('fs');
            const { resolve, join } = await import('path');
            const libDir = resolve('data/flow-library');
            mkdirSync(libDir, { recursive: true });
            const flowPath = join(libDir, `${appName}.json`);
            writeFileSync(flowPath, JSON.stringify(body, null, 2), 'utf-8');
            return { success: true, message: `Flow saved for ${appName}`, path: flowPath };
        });
        // Set clipboard — set text into clipboard for pasting
        this.routes.set('/set-clipboard', async (body) => {
            const text = body.text;
            if (!text)
                throw new Error('Missing required field: text');
            const { runPSRawInteractive } = await import('./ps-exec.js');
            try {
                const escaped = text.replace(/'/g, "''");
                runPSRawInteractive(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::Clear(); [System.Windows.Forms.Clipboard]::SetText('${escaped}'); Write-Output OK`, 10000);
                return { success: true, length: text.length };
            }
            catch (err) {
                return { success: false, error: err instanceof Error ? err.message : String(err) };
            }
        });
        // Copy — select all + copy from a window, return clipboard text
        this.routes.set('/copy', async (body, conn) => {
            const pid = body.pid;
            if (!pid)
                throw new Error('Missing required field: pid');
            if (!conn.isConnected(pid))
                await conn.connect(pid);
            // Focus the window, Ctrl+A to select all, Ctrl+C to copy
            await conn.act(pid, '', 'hotkey', { keys: ['ctrl', 'a'] });
            await new Promise(r => setTimeout(r, 200));
            await conn.act(pid, '', 'hotkey', { keys: ['ctrl', 'c'] });
            await new Promise(r => setTimeout(r, 300));
            // Read clipboard via PowerShell
            const { execSync } = await import('child_process');
            try {
                const text = execSync('powershell -NoProfile -Command "Get-Clipboard"', { encoding: 'utf-8', timeout: 5000, shell: 'cmd.exe' }).trim();
                return { pid, success: true, text };
            }
            catch (err) {
                return { pid, success: false, error: 'Could not read clipboard', text: '' };
            }
        });
        // Read — just read clipboard without selecting (for reading after manual copy)
        this.routes.set('/clipboard', async () => {
            const { execSync } = await import('child_process');
            try {
                const text = execSync('powershell -NoProfile -Command "Get-Clipboard"', { encoding: 'utf-8', timeout: 5000, shell: 'cmd.exe' }).trim();
                return { success: true, text };
            }
            catch {
                return { success: false, text: '', error: 'Could not read clipboard' };
            }
        });
        // Describe — screenshot + Vision AI to read what's on screen
        this.routes.set('/describe', async (body, conn) => {
            const pid = body.pid;
            const name = body.name;
            if (!pid && !name)
                throw new Error('Missing required field: pid or name');
            let targetPid = pid;
            if (!targetPid && name) {
                const found = await conn.find(name);
                if (found.length === 0)
                    throw new Error(`No app found: ${name}`);
                const withWindow = found.filter(p => p.windowTitle && p.windowTitle.length > 0);
                targetPid = (withWindow.length > 0 ? withWindow[0] : found[0]).pid;
            }
            if (!conn.isConnected(targetPid))
                await conn.connect(targetPid);
            const screenshotResult = await conn.screenshot(targetPid);
            if (!screenshotResult.data && !screenshotResult.base64) {
                throw new Error('Screenshot failed');
            }
            const imageData = screenshotResult.data || screenshotResult.base64;
            // Use Anthropic Vision API if available
            const apiKey = process.env.ANTHROPIC_API_KEY;
            if (!apiKey) {
                return {
                    pid: targetPid,
                    screenshot: screenshotResult.path,
                    description: 'Set ANTHROPIC_API_KEY environment variable to enable Vision AI descriptions.',
                };
            }
            const { default: Anthropic } = await import('@anthropic-ai/sdk');
            const client = new Anthropic({ apiKey });
            const response = await client.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 2048,
                messages: [{
                        role: 'user',
                        content: [
                            {
                                type: 'image',
                                source: { type: 'base64', media_type: 'image/png', data: imageData },
                            },
                            {
                                type: 'text',
                                text: 'Describe what you see on this application window screenshot. Be specific about: the app name, all visible text content, buttons, menus, input fields, and any messages or data shown. Be concise but thorough.',
                            },
                        ],
                    }],
            });
            const description = response.content
                .filter((b) => b.type === 'text')
                .map((b) => b.text)
                .join('\n');
            return { pid: targetPid, screenshot: screenshotResult.path, description };
        });
        // Launch / Focus
        this.routes.set('/open', async (body) => {
            const target = body.target;
            if (!target)
                throw new Error('Missing required field: target (app name or path)');
            const { execSync } = await import('child_process');
            const platform = (await import('os')).platform();
            try {
                if (platform === 'win32') {
                    execSync(`start "" "${target}"`, { shell: 'cmd.exe', stdio: 'pipe', windowsHide: false });
                }
                else {
                    execSync(`open "${target}"`, { stdio: 'pipe' });
                }
                // Wait for the app to start
                await new Promise(r => setTimeout(r, 2000));
                return { success: true, message: `Launched ${target}` };
            }
            catch (err) {
                return { success: false, error: err instanceof Error ? err.message : String(err) };
            }
        });
        this.routes.set('/focus', async (body, conn) => {
            const pid = body.pid;
            const name = body.name;
            if (!pid && !name)
                throw new Error('Missing required field: pid or name');
            let targetPid = pid;
            if (!targetPid && name) {
                const found = await conn.find(name);
                if (found.length === 0)
                    throw new Error(`No app found: ${name}`);
                const withWindow = found.filter(p => p.windowTitle && p.windowTitle.length > 0);
                targetPid = (withWindow.length > 0 ? withWindow[0] : found[0]).pid;
            }
            // Use Vision input's ForceForeground
            const { clickAt } = await import('./plugins/vision/input.js');
            const { getWindowBounds } = await import('./plugins/vision/input.js');
            const bounds = getWindowBounds(targetPid);
            if (!bounds.success)
                throw new Error(bounds.error || 'Cannot find window');
            // Click center of window to bring to front
            clickAt(targetPid, (bounds.x || 0) + (bounds.width || 0) / 2, (bounds.y || 0) + 30);
            return { success: true, pid: targetPid, title: bounds.title };
        });
        // Diagnostics
        this.routes.set('/cache-stats', async (_body, conn) => {
            return conn.cacheStats();
        });
        this.routes.set('/audit-log', async (body, conn) => {
            const limit = body.limit || 50;
            return conn.auditLog(limit);
        });
        this.routes.set('/health-summary', async (_body, conn) => {
            return conn.healthSummary();
        });
        // Environment
        this.routes.set('/environment', async () => {
            return this.environment;
        });
        // ─── Feature 1: Real-time Focus Tracking ─────────────────────
        this.routes.set('/focused', async (body, conn) => {
            const pid = body.pid;
            if (!pid)
                throw new Error('Missing required field: pid');
            const result = await conn.focused(pid);
            return result;
        });
        // ─── Feature 2: Element Addressing by Path ───────────────────
        this.routes.set('/find-by-path', async (body, conn) => {
            const pid = body.pid;
            if (!pid)
                throw new Error('Missing required field: pid');
            const selector = {
                path: body.path,
                name: body.name,
                parent: body.parent,
                type: body.type,
                occurrence: body.occurrence,
            };
            const elements = await conn.findByPath(pid, selector);
            return { pid, count: elements.length, elements };
        });
        // ─── Feature 3: State-change Listener ────────────────────────
        this.routes.set('/watch', async (body, conn) => {
            const pid = body.pid;
            if (!pid)
                throw new Error('Missing required field: pid');
            const durationMs = body.durationMs || 3000;
            const pollMs = body.pollMs || 200;
            const events = await conn.watchChanges(pid, durationMs, pollMs);
            return { pid, eventCount: events.length, events };
        });
        // ─── Feature 4: Atomic Action Chains ─────────────────────────
        this.routes.set('/atomic', async (body, conn) => {
            const pid = body.pid;
            if (!pid)
                throw new Error('Missing required field: pid');
            const steps = body.steps;
            if (!steps || !Array.isArray(steps))
                throw new Error('Missing required field: steps (array)');
            const label = body.label || 'atomic-chain';
            const result = await conn.atomicChain({ pid, steps, label });
            return { pid, label, ...result };
        });
        // ─── Feature 5: Smart Element Resolution ─────────────────────
        this.routes.set('/smart-invoke', async (body, conn) => {
            const pid = body.pid;
            const name = body.name;
            if (!pid || !name)
                throw new Error('Missing required fields: pid, name');
            const result = await conn.smartInvoke(pid, name, {
                parent: body.parent,
                type: body.type,
                occurrence: body.occurrence,
            });
            return { pid, name, ...result };
        });
    }
}
//# sourceMappingURL=server.js.map