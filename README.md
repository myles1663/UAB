# Universal App Bridge (UAB)

[![Tests](https://img.shields.io/badge/tests-172%20passing-brightgreen)]() [![Version](https://img.shields.io/badge/version-1.0.0-blue)]() [![License](https://img.shields.io/badge/license-BSL%201.1-blue)]() [![Node](https://img.shields.io/badge/node-%3E%3D18-green)]() [![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)]()

**Smart function discovery and framework-level desktop app control for AI agents.**

UAB doesn't just automate apps — it **discovers**, **identifies**, **learns**, and **remembers** how to control every application on your system. The first time it sees an app, it figures out what framework it uses, which control method works best, and stores that knowledge for instant recall. Every subsequent interaction is faster and smarter.

## One-Click Install

UAB ships as a packaged installer. Run it once and every AI agent on the machine gets native desktop control.

```bash
# GUI installer (recommended)
cd installer && npm install && npx electron src/main.js

# CLI install (for terminal users)
uab-bridge install
```

The installer:
- Starts UABServer as a system service (auto-starts on boot)
- Installs the Chrome extension for browser bridge
- Writes skill files for Claude Co-work AND Claude Code
- Generates an API key for authenticated access
- Detects host network for VM accessibility

Works with: Claude Co-work, Claude Code CLI, Claude Code Desktop, and any agent that can make HTTP calls.

## The Core Innovation: Smart Function Discovery

Most automation tools require you to know what app you're controlling and how to connect. UAB figures it out for you:

```
        ┌──────────────────────────────────────────────────────────┐
        │              Smart Function Discovery                     │
        │                                                          │
        │  1. SCAN ─────────► DLL module scanning                  │
        │     "What's running?"   Batch process enumeration        │
        │                         Window title fetching            │
        │                                   │                      │
        │  2. IDENTIFY ─────► Framework signature matching         │
        │     "What framework?"   electron.exe → Electron          │
        │                         qt6core.dll  → Qt6               │
        │                         xlcall32.dll → Office            │
        │                         jvm.dll      → Java              │
        │                                   │                      │
        │  3. REGISTER ─────► In-memory Map + JSON persistence     │
        │     "Remember this"     O(1) lookup by PID or name       │
        │                         Dual-indexed (exe + PID)         │
        │                         Git-friendly registry.json       │
        │                                   │                      │
        │  4. CONNECT ──────► Plugin cascade with fallback         │
        │     "Best method?"      CDP → COM → UIA (automatic)     │
        │                         Preferred method remembered      │
        │                                   │                      │
        │  5. LEARN ────────► Update registry with results         │
        │     "Next time faster"  Store preferred control method   │
        │                         Cache element trees              │
        │                         Track connection health          │
        └──────────────────────────────────────────────────────────┘
```

### What Makes This "Smart"?

| Traditional Automation | UAB Smart Discovery |
|----------------------|---------------------|
| You specify the app and how to connect | UAB scans the system and finds everything automatically |
| Hard-coded framework assumptions | DLL scanning identifies the exact framework with confidence scores |
| No memory between sessions | Registry persists knowledge in JSON — instant recall next time |
| Single control method | Cascade tries best method first, falls back automatically |
| Manual configuration per app | Zero-config — scan once, control anything |

## Quick Start

### As a Library

```typescript
import { UABConnector } from 'universal-app-bridge';

const uab = new UABConnector();
await uab.start();

// 1. SCAN — Discover everything running
const apps = await uab.scan();
// → 79 apps found, frameworks identified, profiles registered

// 2. FIND — Smart lookup (registry first, live detection fallback)
const excel = await uab.find('excel');
// → Instant hit from registry (O(1) Map lookup)

// 3. CONNECT — Best method selected automatically
const conn = await uab.connect('excel');
// → { pid: 5678, name: 'EXCEL', framework: 'office', method: 'com+uia', elementCount: 342 }

// 4. QUERY — Search the UI tree
const buttons = await uab.query(conn.pid, { type: 'button', label: 'Save' });

// 5. ACT — Perform actions (permission-checked, retried, cache-aware)
await uab.act(conn.pid, buttons[0].id, 'click');

// Next session: scan() is instant because registry.json remembers everything
await uab.stop();
```

### As a CLI (for any AI agent)

The CLI outputs pure JSON — designed for Claude, GPT, or any agent calling via bash:

```bash
# Scan and register all running apps
uab scan
# → { "success": true, "apps": [...79 apps with frameworks...] }

# List known apps from registry (instant, no scan needed)
uab apps
# → Instant recall from registry.json

# Smart search — registry first, live detection fallback
uab find "notepad"

# Connect with automatic method selection
uab connect notepad
# → { "pid": 1234, "method": "accessibility", "elementCount": 15 }

# Query and act
uab query 1234 --type button --label "Save"
uab act 1234 btn_42 click

# Registry persists between sessions — next time is instant
uab profiles
# → Shows all known apps with framework info and preferred methods
```

### As an HTTP Server (for remote / server-side agents)

Run UAB as a REST API so agents on other machines, in containers, or in cloud environments can control desktop apps remotely:

```bash
# Start the server (localhost only)
uab serve --port 3100

# Listen on all interfaces (for VM or remote access)
uab serve --port 3100 --host 0.0.0.0

# With authentication (recommended for non-localhost)
uab serve --port 3100 --host 0.0.0.0 --api-key my-secret-key
```

```bash
# From any HTTP client or remote agent:
curl -X POST http://localhost:3100/scan
curl -X POST http://localhost:3100/find -d '{"query":"notepad"}'
curl -X POST http://localhost:3100/connect -d '{"target":"notepad"}'
curl -X POST http://localhost:3100/query -d '{"pid":1234,"selector":{"type":"button"}}'
curl -X POST http://localhost:3100/act -d '{"pid":1234,"elementId":"btn_1","action":"click"}'
curl -X POST http://localhost:3100/open -d '{"target":"notepad"}'
curl -X POST http://localhost:3100/focus -d '{"pid":1234}'
curl -X POST http://localhost:3100/describe -d '{"pid":1234}'

# Health check
curl http://localhost:3100/health
```

```typescript
// Or programmatically:
import { UABServer } from 'universal-app-bridge/server';

const server = new UABServer({ port: 3100, host: '0.0.0.0', apiKey: 'secret' });
await server.start();
// Clients POST JSON to /scan, /connect, /query, /act, /open, /focus, /describe, etc.
```

### Environment Auto-Detection

UAB automatically detects its runtime context and tunes behavior accordingly:

| Environment | Session | Persistence | Rate Limit | Extension Bridge |
|-------------|---------|-------------|------------|-----------------|
| **Desktop** | Session 1+ | Persistent connections | 100/min/PID | Enabled |
| **Server** | Session 0 (SSH/service) | Stateless | 60/min/PID | Disabled |
| **Container** | Docker/WSL | Stateless | 30/min/PID | Disabled |

```bash
# Check what UAB detected:
uab env
# → { "environment": { "mode": "desktop", "hasDesktop": true, ... }, "defaults": { ... } }
```

**ONE codebase, ZERO configuration** — UAB figures out where it's running and adapts.

## Architecture

```
Agent Runtime (Claude / GPT / Any AI Agent)
         │
    Library API  or  CLI (JSON)  or  HTTP Server (REST)
         │
┌────────┴───────────────────────────────────────────────────┐
│              Universal App Bridge (UAB)                      │
│                                                             │
│  ┌─────────────┐  ┌────────────┐  ┌─────────────────────┐  │
│  │  Smart       │  │  App       │  │   UAB Connector     │  │
│  │  Detector    │  │  Registry  │  │   (Public API)      │  │
│  │             │  │  (Brain)   │  │                     │  │
│  │ DLL scan    │  │ Map + JSON │  │ scan() find()       │  │
│  │ Batch enum  │  │ O(1) lookup│  │ connect() query()   │  │
│  │ Signatures  │  │ Persist    │  │ act() state()       │  │
│  └──────┬──────┘  └─────┬──────┘  └──────────┬──────────┘  │
│         │               │                     │             │
│         └───────────────┼─────────────────────┘             │
│                         │                                   │
│  ┌──────────────────────┴────────────────────────────────┐  │
│  │                  Plugin Manager                        │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │  │
│  │  │Chrome Ext│ │ Browser  │ │ Electron │ │  Office  │ │  │
│  │  │  (WS)    │ │  (CDP)   │ │  (CDP)   │ │(COM+UIA) │ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │  │
│  │  │   Qt     │ │   GTK    │ │  Java    │ │ Flutter  │ │  │
│  │  │  (UIA)   │ │  (UIA)   │ │(JAB→UIA) │ │  (UIA)   │ │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │  │
│  │  ┌──────────┐ ┌──────────┐                              │  │
│  │  │ Win-UIA  │ │  Vision  │                              │  │
│  │  │ (A11y)   │ │(AI last  │                              │  │
│  │  │          │ │ resort)  │                              │  │
│  │  └──────────┘ └──────────┘                              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │  Cache   │ │Permission│ │  Retry   │ │ Chain Engine │   │
│  │ (3-tier) │ │ (Audit)  │ │(Backoff) │ │ (Workflows)  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
│                                                             │
│  ┌──────────────────┐  ┌────────────────────────────────┐   │
│  │ Control Router   │  │  Connection Manager            │   │
│  │ (Cascade+Fallback│  │  (Health+Reconnect+Cleanup)    │   │
│  └──────────────────┘  └────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         │
    Operating System (CDP, UIA, COM, PowerShell, WMI)
         │
    Desktop Applications
```

### The Cascade Pattern

UAB picks the best control method for each app automatically, falling back through the stack if something fails:

```
Priority 1: Chrome Extension Bridge (browsers — no relaunch needed)
Priority 2: CDP Browser Plugin (browsers — with debug flag)
Priority 3: Framework Hook (Electron CDP, Office COM)
Priority 4: Windows UI Automation (accessibility fallback — any windowed app)
Priority 5: Vision (screenshot + Claude Vision API + coordinate input — last resort)
```

If a CDP connection drops mid-session, the router transparently falls back to UIA — and if UIA fails too, Vision takes a screenshot and uses AI to identify elements. The agent never sees the switch.

> **Vision fallback** works like Anthropic's computer use tool: screenshot → Claude analyzes the image → returns element coordinates → UAB clicks at (x,y). It's expensive (API call per analysis) and slow, but works with *anything* visible on screen. Requires `ANTHROPIC_API_KEY`.

## Smart Discovery Deep Dive

### Phase 1: Detection

UAB scans the system using **three batched PowerShell calls** (not per-process — batched for speed):

1. **WMI Process Enumeration** — Get all running processes with PIDs, names, paths, command lines
2. **Batch DLL Module Scan** — One PowerShell call scans loaded modules for ALL processes (batches of 50)
3. **Batch Window Title Scan** — One P/Invoke call via `EnumWindows` gets all visible window titles

**Result:** Full system scan in 2-5 seconds. Finds 79+ controllable apps on a typical Windows desktop.

### Phase 2: Framework Identification

Each detected process is matched against **framework signatures**:

```typescript
// Example: How UAB identifies an Electron app
{
  framework: 'electron',
  modules: ['electron.exe', 'libcef.dll', 'chrome_elf.dll', 'v8.dll'],
  filePatterns: ['resources/app.asar', 'resources/app.asar.unpacked'],
  commandLine: ['--type=renderer', 'electron', 'app.asar'],
  baseConfidence: 0.9
}
```

Confidence accumulates: base score + module matches + command-line matches + file pattern matches. An Electron app loading `chrome_elf.dll` AND having `resources/app.asar` gets confidence 0.95.

**10 framework signatures** built in: Electron, Qt5, Qt6, GTK3, GTK4, WPF, .NET, Flutter, Java, Office.

Plus **fast-path detection** for browsers (Chrome, Edge, Brave) and Office apps (Word, Excel, PowerPoint, Outlook) by executable name.

### Phase 3: Registry & Persistence

Every detected app is registered in the **App Registry** — UAB's brain:

```typescript
// What the registry stores per app
interface AppProfile {
  executable: string;       // Stable key: "code.exe"
  name: string;             // "Visual Studio Code"
  pid: number;              // Last known PID
  framework: FrameworkType; // "electron"
  confidence: number;       // 0.95
  preferredMethod: string;  // "cdp" (learned from successful connection)
  path: string;             // Full executable path
  windowTitle: string;      // "project - Visual Studio Code"
  lastSeen: number;         // Unix timestamp
  tags: string[];           // User-defined categorization
}
```

The registry uses **dual-indexed Maps** for O(1) lookups:
- `Map<executable, AppProfile>` — lookup by executable name
- `Map<pid, executable>` — lookup by PID → executable → profile

**JSON persistence:** The entire registry is saved to `data/uab-profiles/registry.json` — a single, git-friendly file with readable diffs. No database required.

### Phase 4: Smart Lookup

When you call `find("excel")`, UAB doesn't scan the system again. It:

1. **Checks the registry first** — O(1) Map lookup, case-insensitive substring match
2. **Returns instantly** if found (< 1ms)
3. **Only falls back to live detection** if not in registry

This is why the first `scan()` takes 2-5 seconds, but every subsequent `find()` is instant.

### Phase 5: Learning

After each successful connection, UAB updates the registry with what worked:

```typescript
// After connecting to VS Code via CDP:
registry.update('code.exe', {
  preferredMethod: 'cdp',    // Remember: CDP works for this app
  pid: 12345,                // Update last known PID
  lastSeen: Date.now()       // Update timestamp
});
```

Next time you connect to VS Code, UAB tries CDP first because it learned that's the best method.

## Supported Frameworks

| Framework | Plugin | Method | Apps Covered |
|-----------|--------|--------|-------------|
| **Chrome/Edge/Brave** | Extension Bridge | WebSocket | Any Chromium browser — tabs, cookies, DOM, storage, JS exec |
| **Chrome/Edge/Brave** | CDP Fallback | CDP | Same browsers, requires `--remote-debugging-port` |
| **Electron** | Chrome DevTools Protocol | CDP | VS Code, Slack, Discord, Notion, Obsidian, Spotify, Teams |
| **MS Office** | COM Automation + UIA | COM+UIA | Word, Excel, PowerPoint, Outlook |
| **Qt 5/6** | UIA Bridge | UIA | VLC, Telegram Desktop, OBS Studio, VirtualBox, Wireshark |
| **GTK 3/4** | UIA Bridge | UIA | GIMP, Inkscape, GNOME apps |
| **WPF/.NET** | Windows UI Automation | UIA | Windows enterprise apps, Visual Studio |
| **Flutter** | UIA Bridge | UIA | Google apps, Ubuntu desktop apps |
| **Java Swing/FX** | JAB→UIA Bridge | UIA | JetBrains IDEs, Android Studio |
| **Win32** | Windows UI Automation | UIA | Universal fallback for any Windows app |

## Unified API

Every framework plugin maps its native UI tree into the same types:

### `uab.scan()` — Discover & Register

```typescript
const apps = await uab.scan();
// Apps are detected, frameworks identified, and profiles registered
// Registry persists to disk — next session starts with full knowledge
```

### `uab.find(name)` — Smart Lookup

```typescript
const results = await uab.find('slack');
// 1. Checks registry (instant) → returns if found
// 2. Falls back to live detection → registers result
```

### `uab.connect(target)` — Auto-Connect

```typescript
// By name (searches registry, then live-detects)
const conn = await uab.connect('notepad');

// By PID (checks registry, auto-detects if not found)
const conn = await uab.connect(1234);

// Returns: { pid, name, framework, method, elementCount }
```

### `uab.enumerate(pid)` — List UI Elements

```typescript
const tree = await uab.enumerate(pid);
// Cached for 5 seconds — repeated calls are instant
```

### `uab.query(pid, selector)` — Search Elements

```typescript
const btns = await uab.query(pid, { type: 'button', label: 'Save' });
// Cached for 3 seconds, auto-invalidated after mutating actions
```

### `uab.act(pid, elementId, action, params?)` — Perform Actions

```typescript
await uab.act(pid, 'btn_1', 'click');
await uab.act(pid, 'input_3', 'type', { text: 'Hello' });
// Permission-checked → retried on transient failure → cache invalidated
```

## Production Hardening

### Smart Three-Tier Cache

```
┌──────────────────────────────────────────┐
│              Element Cache               │
│                                          │
│  Tree Cache    │  5s TTL per PID         │
│  Query Cache   │  3s TTL, 50 max/PID    │
│  State Cache   │  2s TTL per PID         │
│                                          │
│  Auto-invalidation on mutating actions:  │
│  click, type, keypress, navigate, etc.   │
│                                          │
│  Safe (no invalidation):                 │
│  focus, hover, scroll, screenshot, etc.  │
└──────────────────────────────────────────┘
```

### Permission & Safety Model

- **Risk classification:** safe / moderate / destructive
- **Rate limiting:** 100 actions/min per PID (configurable)
- **Audit log:** Last 1000 actions with timestamps, PIDs, elements, risk levels
- **Destructive action gating:** `close` requires explicit confirmation when blocking is enabled

### Health Monitoring

- 30-second health check intervals
- Auto-reconnect with exponential backoff (1s → 2s → 4s → 8s)
- Stale connection cleanup after 5 minutes of failure
- Event callbacks for connection state changes

### Retry with Backoff

- Exponential backoff with 0-30% jitter
- Retryable error detection (ECONNRESET, timeout, EPIPE, socket hang up)
- Per-operation timeout with configurable limits
- Labeled operations for debugging

## Action Chains

Multi-step workflows with verification between steps:

```typescript
const chain = {
  name: 'fill-form',
  pid: 1234,
  steps: [
    { type: 'action', selector: { label: 'Name' }, action: 'type', params: { text: 'John' } },
    { type: 'wait', selector: { type: 'button', label: 'Submit' }, timeoutMs: 5000 },
    { type: 'action', selector: { label: 'Submit' }, action: 'click' },
  ],
};

const result = await chainExecutor.execute(chain);
```

## Chrome Extension Bridge

UAB includes a Chrome Extension (Manifest V3) that connects to your running browser via WebSocket — **no browser relaunch required**.

```
┌────────────────────┐    WebSocket     ┌────────────────────┐
│   UAB Service      │◄───(port 8787)──►│  Chrome Extension  │
│   (Node.js)        │    JSON protocol │  (Manifest V3)     │
└────────────────────┘                  └────────────────────┘
```

**Full browser control:** Tabs, cookies, localStorage, sessionStorage, navigation, JavaScript execution, screenshots — all without relaunching the browser.

## Co-work Bridge

UAB works seamlessly with Claude Co-work. The installer writes skill files directly into Co-work's plugin directory. Co-work reaches UABServer through Chrome's localhost access — no port forwarding, no configuration.

The Chrome extension acts as a relay: Co-work → Chrome extension → localhost:3100 → UABServer → desktop apps.

### Recursive Application Bridge

UAB doesn't just control apps — it learns how to control them better with every interaction.

The **Flow Library** (`data/flow-library/`) stores pre-built interaction sequences for every app UAB has successfully controlled. Each flow captures the exact steps, input method, and known quirks discovered through real-world testing:

- **ChatGPT**: 1 Tab → type → Enter
- **Grok**: 2 Tabs → keystroke activate → clipboard paste → Enter
- **Excel**: COM API methods (no UI automation needed)
- **Notepad**: Direct SendKeys type

When an agent encounters a new app, it checks `GET /flow/{appname}`. If a flow exists, the agent follows it mechanically — zero exploration, zero guessing. If no flow exists, UAB provides a framework-based default, and the agent saves the working sequence via `POST /flow` after success.

This creates a recursive improvement loop: **Attempt → Verify → Learn → Store → Next attempt is instant.** Unlike human muscle memory that degrades over time, the flow library is permanent, exact, and shared across every agent connected to UAB.

### X-ray Vision for Agents

UAB gives AI agents the same visual understanding of applications that humans have — but in data form.

`POST /deep-query` scans the entire UI tree of any application and returns every named element — buttons, inputs, links, menus, text — with their types, supported actions, and screen positions. One call reveals everything a human can see.

`POST /invoke` acts on any element by name. Find "Copy" → click it. Find "New chat" → click it. No Tab navigation, no coordinate guessing, no screenshots needed.

```bash
# See everything in ChatGPT
curl -X POST localhost:3100/deep-query -H "X-API-Key: KEY" -d '{"pid":28968}'
# → 123 elements: buttons, links, inputs, conversations, model selector...

# Click any button by name
curl -X POST localhost:3100/invoke -H "X-API-Key: KEY" -d '{"pid":28968, "name":"Copy", "occurrence":"last"}'
# → Invokes the last Copy button, returns clipboard text
```

## Session 0 Bridge

UAB works even when running in Session 0 (SSH, Windows Services). It automatically detects Session 0 and routes PowerShell through the Task Scheduler with `/IT` flag to bridge to the interactive desktop session.

## Documentation

| Document | What's Inside |
|----------|--------------|
| [**ARCHITECTURE.md**](ARCHITECTURE.md) | Smart discovery pipeline, cascade routing, plugin architecture, data flow |
| [**GETTING_STARTED.md**](GETTING_STARTED.md) | Install → scan → discover → connect → control walkthrough |
| [**API_REFERENCE.md**](API_REFERENCE.md) | Every method, parameter, and return type for UABConnector & AppRegistry |
| [**SUPPORTED_APPLICATIONS.md**](SUPPORTED_APPLICATIONS.md) | Tested apps with specific operations and benchmarks |
| [**SECURITY.md**](SECURITY.md) | Trust boundaries, permission model, audit trail |
| [**CONTRIBUTING.md**](CONTRIBUTING.md) | How to contribute, write plugins, code standards |
| [**CHANGELOG.md**](CHANGELOG.md) | Version history |

## Key Numbers

| Metric | Value |
|--------|-------|
| Framework plugins | **9** (Electron, Browser, Office, Qt, GTK, Java, Flutter, Chrome Extension, Win-UIA) |
| Framework signatures | **10** (Electron, Qt5, Qt6, GTK3, GTK4, WPF, .NET, Flutter, Java, Office) |
| Element types | **32** normalized types |
| Action types | **61** (UI + keyboard + window + Office + browser) |
| CLI commands | **20+** (all JSON output) |
| Source files | **30** TypeScript files (~11,700 LOC) |
| Apps detected | **79+** on typical Windows desktop |
| Registry lookup | **O(1)** via dual-indexed Maps |

## Why UAB Matters

The person who solves reliable, universal app control for agents unlocks the entire "AI operating system" vision without needing anyone's permission. No waiting for app developers to build APIs. No begging SaaS companies for MCP servers. No fragile pixel-scraping.

**Smart Function Discovery is the key.** Any agent can scan a system, learn what's running, and control it — all with zero configuration. The registry remembers everything across sessions, making each interaction faster than the last.

Hook into the framework, own the interface.

## Requirements

- **Node.js** >= 18.0.0
- **Windows** (primary platform — UIA, COM, PowerShell)
- Linux/macOS support via framework-specific plugins

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `UAB_LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `UAB_LOG_FILE` | _(none)_ | Optional file path for log output |
| `LOG_LEVEL` | `info` | Fallback log level (if UAB_LOG_LEVEL not set) |

## License

Universal App Bridge is licensed under the **Business Source License 1.1**.

**Permitted:** Personal use, academic research, evaluation, testing, open source projects.

**Requires commercial license:** Commercial agent runtimes, SaaS platforms, enterprise internal use (25+ employees), competing products, and deployments to 5+ users/devices.

**Patent notice:** This software is subject to pending patent applications. The Change Date license conversion does not grant patent rights beyond those stated in the License.

Each version converts to Apache 2.0 four years after release.

See [LICENSE](./LICENSE) for full terms.
