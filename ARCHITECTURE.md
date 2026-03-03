# Architecture

> How UAB hooks into the OS automation layer, discovers application UI trees, and achieves framework-level access without per-app plugins.

## Table of Contents

- [System Overview](#system-overview)
- [The Cascade Pattern](#the-cascade-pattern)
- [Framework Detection](#framework-detection)
- [Control Router](#control-router)
- [Plugin Architecture](#plugin-architecture)
- [Data Flow](#data-flow)
- [Production Hardening](#production-hardening)
- [Session Bridge](#session-bridge)

---

## System Overview

UAB sits between the agent runtime and the desktop OS. It provides a unified API surface while using framework-specific protocols underneath.

```
┌──────────────────────────────────────────────────────────────┐
│                      Agent Runtime                           │
│              (Claude, GPT, Custom Agent)                     │
└──────────────────────┬───────────────────────────────────────┘
                       │  TypeScript API  or  CLI (JSON)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                   UAB Service Layer                          │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │  Framework    │  │   Control    │  │   Connection      │  │
│  │  Detector     │──│   Router     │──│   Manager         │  │
│  │              │  │  (Cascade)   │  │  (Health/Reconnect)│  │
│  └──────────────┘  └──────┬───────┘  └───────────────────┘  │
│                           │                                  │
│  ┌────────────────────────┴──────────────────────────────┐  │
│  │                 Plugin Manager                        │  │
│  │                                                       │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│  │
│  │  │ Electron │ │ Browser  │ │  Office  │ │   Qt     ││  │
│  │  │  (CDP)   │ │  (CDP)   │ │(COM+UIA) │ │  (UIA)   ││  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘│  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│  │
│  │  │  GTK     │ │  Java    │ │ Flutter  │ │ Win-UIA  ││  │
│  │  │  (UIA)   │ │(JAB→UIA) │ │  (UIA)   │ │(fallback)││  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘│  │
│  │  ┌──────────┐                                        │  │
│  │  │Chrome Ext│                                        │  │
│  │  │  (WS)    │                                        │  │
│  │  └──────────┘                                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐   │
│  │  Cache   │ │Permission│ │  Retry   │ │ Chain Engine │   │
│  │ (TTL)    │ │ (Audit)  │ │(Backoff) │ │ (Workflows)  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘   │
└──────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                    Operating System                           │
│                                                              │
│  ┌─────────────┐ ┌─────────────┐ ┌──────────────────────┐  │
│  │ Chrome      │ │  Windows    │ │   COM Automation     │  │
│  │ DevTools    │ │  UI         │ │   (Office)           │  │
│  │ Protocol    │ │  Automation │ │                      │  │
│  └─────────────┘ └─────────────┘ └──────────────────────┘  │
│  ┌─────────────┐ ┌─────────────┐                            │
│  │ PowerShell  │ │  WMI        │                            │
│  │ (Scripts)   │ │  (Process)  │                            │
│  └─────────────┘ └─────────────┘                            │
└──────────────────────────────────────────────────────────────┘
```

---

## The Cascade Pattern

The core insight: different apps expose different levels of automation. UAB doesn't force a single method. Instead, it **cascades** through control methods from highest-fidelity to most-universal:

```
Priority 1: Direct API (MCP server, REST endpoint — future)
     │ fail
     ▼
Priority 2: Framework Hook (CDP for Electron, COM for Office)
     │ fail
     ▼
Priority 3: Windows UI Automation (universal, any windowed app)
     │ fail
     ▼
Priority 4: Vision + Input Injection (screenshot → coordinates — future)
```

### Why This Matters

| Method | Speed | Fidelity | Coverage |
|--------|-------|----------|----------|
| Direct API | Fastest | Perfect | App-specific |
| Framework Hook | Fast | High | Framework-specific |
| UI Automation | Moderate | Good | Any Windows app |
| Vision | Slow | Variable | Anything with pixels |

UAB picks the best available method automatically. If a framework plugin fails mid-session, the router falls back to the next method transparently — the agent never sees the switch.

### Fallback in Practice

```
Agent: uab.act(pid, 'btn-1', 'click')
                │
                ▼
        Router checks current route
                │
        ┌───────┴───────┐
        │  Electron CDP  │ ──▶ WebSocket error!
        └───────┬───────┘
                │ automatic fallback
        ┌───────┴───────┐
        │   Win-UIA     │ ──▶ Success ✓
        └───────────────┘
                │
                ▼
        Agent gets ActionResult (success)
        (never knew about the fallback)
```

---

## Framework Detection

Detection is the first step. UAB scans running processes to identify what frameworks they use.

### Detection Pipeline

```
WMI Process Enumeration
         │
         ▼
┌─────────────────────────┐
│  Filter System Processes │  (svchost, csrss, dwm, etc. — 40+ excluded)
└────────────┬────────────┘
             ▼
┌─────────────────────────┐
│  Batch DLL Module Scan   │  (PowerShell: Get-Process → Modules)
└────────────┬────────────┘
             ▼
┌─────────────────────────┐
│  Batch Window Title Scan │  (EnumWindows API via PowerShell)
└────────────┬────────────┘
             ▼
┌─────────────────────────┐
│  Framework Signature     │
│  Matching                │
│                         │
│  electron.exe → Electron│
│  xlcall32.dll → Office  │
│  qt6core.dll  → Qt6     │
│  jvm.dll      → Java    │
│  flutter_*.dll→ Flutter  │
└────────────┬────────────┘
             ▼
   DetectedApp[] with confidence scores
```

### Signature Matching

Each framework has a signature definition:

```typescript
{
  framework: 'electron',
  modules: ['electron.exe', 'libcef.dll', 'chrome_elf.dll'],
  filePatterns: ['resources/app.asar'],
  commandLine: ['--type=renderer'],
  baseConfidence: 0.9
}
```

Confidence accumulates: base score + module matches + command-line matches + file pattern matches. The detector returns apps sorted by confidence.

### Performance

The detector batches PowerShell calls to minimize process spawn overhead:
- **One** call for all process info (WMI)
- **One** call for all module scanning
- **One** call for all window titles

Typical scan time: **2-5 seconds** for a full desktop.

---

## Control Router

The router maps detected apps to control methods and manages fallback.

### Route Selection

```typescript
// Router internals (simplified)
async connect(app: DetectedApp): Promise<RoutedConnection> {
  // 1. Try framework-specific plugin
  const plugin = this.pluginManager.findPlugin(app);
  if (plugin) {
    try {
      const conn = await plugin.connect(app);
      return new RoutedConnection(conn, this, app);
    } catch (e) {
      // Plugin failed, fall through
    }
  }

  // 2. Try Win-UIA universal fallback
  const uia = this.pluginManager.getPlugin('win-uia');
  if (uia) {
    const conn = await uia.connect(app);
    return new RoutedConnection(conn, this, app);
  }

  throw new Error(`No control method available for ${app.name}`);
}
```

### RoutedConnection

The `RoutedConnection` wraps any `PluginConnection` and adds automatic fallback:

```
RoutedConnection
  ├── wraps: PluginConnection (e.g., ElectronPlugin)
  ├── fallback(): tries next method in cascade
  └── every method call: try current → catch → fallback → retry
```

---

## Plugin Architecture

### Plugin Interface

Every plugin implements:

```typescript
interface FrameworkPlugin {
  readonly framework: FrameworkType;
  readonly name: string;
  canHandle(app: DetectedApp): boolean;
  connect(app: DetectedApp): Promise<PluginConnection>;
}
```

And every connection implements:

```typescript
interface PluginConnection {
  enumerate(): Promise<UIElement[]>;
  query(selector: ElementSelector): Promise<UIElement[]>;
  act(elementId: string, action: ActionType, params?: ActionParams): Promise<ActionResult>;
  state(): Promise<AppState>;
  disconnect(): Promise<void>;
  connected: boolean;
}
```

### Plugin Registration Order

Plugins are registered in priority order. The plugin manager tries each one until `canHandle()` returns true:

```
1. ChromeExtPlugin   — Chrome extension bridge (WebSocket, no relaunch)
2. BrowserPlugin     — Browser CDP (needs --remote-debugging-port)
3. ElectronPlugin    — Electron CDP
4. OfficePlugin      — COM + UIA hybrid
5. QtPlugin          — Qt via UIA
6. GtkPlugin         — GTK via UIA
7. JavaPlugin        — Java via JAB→UIA
8. FlutterPlugin     — Flutter via UIA
9. WinUIAPlugin      — Universal fallback (any Windows app)
```

### How Each Plugin Works

#### Electron Plugin (CDP)
```
ElectronPlugin
  │
  ├── Detect: Look for --remote-debugging-port in cmdline
  ├── Connect: WebSocket to CDP endpoint
  ├── Enumerate: CDP Runtime.evaluate → DOM traversal → UIElement tree
  ├── Query: CSS selector matching on DOM
  ├── Act: CDP Input.dispatchMouseEvent / DOM.focus / etc.
  └── Disconnect: Close WebSocket
```

#### Office Plugin (COM + UIA Hybrid)
```
OfficePlugin
  │
  ├── Detect: Match WINWORD.EXE, EXCEL.EXE, POWERPNT.EXE, OUTLOOK.EXE
  ├── Connect: Initialize both UIA session AND COM automation object
  ├── Enumerate: UIA for UI tree, COM for document content
  ├── Query: UIA for buttons/menus, COM for cells/ranges/slides
  ├── Act:
  │   ├── UI actions (click, type) → UIA
  │   ├── readCell, writeCell, readRange → COM (Excel)
  │   ├── readDocument → UIA TextPattern (Word)
  │   ├── readSlides → COM (PowerPoint)
  │   └── composeEmail, sendEmail → COM (Outlook)
  └── Disconnect: Release COM objects, close UIA session
```

#### Win-UIA Plugin (Universal Fallback)
```
WinUIAPlugin
  │
  ├── Detect: canHandle() returns true for ANY Windows app
  ├── Connect: Start PowerShell interactive session
  ├── Enumerate: AutomationElement.FindAll() via PowerShell
  ├── Query: Condition-based search (PropertyCondition, AndCondition)
  ├── Act:
  │   ├── InvokePattern → click/invoke
  │   ├── ValuePattern → type/clear
  │   ├── TogglePattern → check/uncheck/toggle
  │   ├── ExpandCollapsePattern → expand/collapse
  │   ├── SelectionItemPattern → select
  │   ├── ScrollItemPattern → scroll
  │   └── SendKeys API → keypress/hotkey
  └── Disconnect: Close PowerShell session
```

---

## Data Flow

### Discovery → Connection → Control (Full Path)

```
    Agent Request: "Click the Submit button in Excel"
                          │
                          ▼
              ┌───────────────────┐
              │   UAB Service     │
              │   detect()        │
              └────────┬──────────┘
                       │
                       ▼
              ┌───────────────────┐
              │   Detector        │  PowerShell WMI scan
              │   detectAll()     │  DLL module matching
              │                   │  Window title fetching
              └────────┬──────────┘
                       │
                       ▼
              DetectedApp { pid: 5678, name: 'EXCEL', framework: 'office' }
                       │
                       ▼
              ┌───────────────────┐
              │   Router          │
              │   connect()       │
              └────────┬──────────┘
                       │
              ┌────────┴────────┐
              │ PluginManager   │
              │ findPlugin()    │──▶ OfficePlugin.canHandle() → true
              └────────┬────────┘
                       │
                       ▼
              ┌───────────────────┐
              │  OfficePlugin     │
              │  connect()        │──▶ COM: GetObject("Excel.Application")
              │                   │──▶ UIA: AutomationElement.FromHandle()
              └────────┬──────────┘
                       │
                       ▼
              RoutedConnection (wrapping OfficePlugin connection)
                       │
                       ▼
              ┌───────────────────┐
              │   UAB Service     │
              │   query(5678,     │
              │     {type:'button',│
              │      label:'Submit'})
              └────────┬──────────┘
                       │
              ┌────────┴────────┐
              │   Cache Check   │──▶ Miss (first query)
              └────────┬────────┘
                       │
                       ▼
              ┌───────────────────┐
              │  Connection       │
              │  query()          │──▶ UIA PropertyCondition match
              └────────┬──────────┘
                       │
              ┌────────┴────────┐
              │   Cache Store   │──▶ Store result (3s TTL)
              └────────┬────────┘
                       │
                       ▼
              UIElement { id: 'btn-submit', type: 'button', label: 'Submit' }
                       │
                       ▼
              ┌───────────────────┐
              │   UAB Service     │
              │   act(5678,       │
              │     'btn-submit', │
              │     'click')      │
              └────────┬──────────┘
                       │
              ┌────────┴────────────┐
              │  Permission Check   │──▶ Risk: safe → Allowed
              │  record() to audit  │
              └────────┬────────────┘
                       │
              ┌────────┴────────┐
              │   withRetry()   │──▶ Attempt 1
              └────────┬────────┘
                       │
                       ▼
              ┌───────────────────┐
              │  Connection       │
              │  act('click')     │──▶ UIA InvokePattern.Invoke()
              └────────┬──────────┘
                       │
              ┌────────┴────────────┐
              │  Cache Invalidate   │──▶ 'click' is mutating → clear PID cache
              └────────┬────────────┘
                       │
                       ▼
              ActionResult { success: true }
```

### Health Check Cycle

```
Every 30 seconds:
  ┌────────────────────────────────┐
  │  ConnectionManager             │
  │  runHealthChecks()             │
  └──────────┬─────────────────────┘
             │
             ▼
  For each tracked connection:
    ┌────────────────────┐
    │ connection.state() │──▶ 5s timeout
    └────────┬───────────┘
             │
        ┌────┴────┐
        │ Success │──▶ Reset failure counter, update lastHealthy
        └─────────┘
        ┌────┴────┐
        │ Failure │──▶ Increment failure counter
        └────┬────┘
             │
        failures >= 3?
             │
        ┌────┴────┐
        │   Yes   │──▶ Attempt reconnect (exponential backoff)
        └────┬────┘
             │
        reconnect failed 3 times?
             │
        ┌────┴────┐
        │   Yes   │──▶ Mark stale → remove after 5 min
        └─────────┘
```

---

## Production Hardening

### Smart Cache

Three-tier cache with intelligent invalidation:

```
┌──────────────────────────────────────────┐
│              Element Cache               │
│                                          │
│  Tree Cache    │  5s TTL per PID         │
│  Query Cache   │  3s TTL, 50 max/PID    │
│  State Cache   │  2s TTL per PID         │
│                                          │
│  Invalidation Triggers:                  │
│  click, type, keypress, navigate,        │
│  setCookie, toggle, expand...            │
│                                          │
│  Safe (no invalidation):                 │
│  focus, hover, scroll, screenshot,       │
│  getCookies, getLocalStorage...          │
└──────────────────────────────────────────┘
```

### Permission & Audit

```
Action Received
      │
      ▼
┌─────────────────┐
│ Rate Limit Check │──▶ 100 actions / 60s per PID
└────────┬────────┘
         │ pass
         ▼
┌─────────────────┐
│ Risk Assessment  │──▶ safe / moderate / destructive
└────────┬────────┘
         │
    destructive + blockDestructive?
         │
    ┌────┴────┐
    │   Yes   │──▶ Check confirmDestructive(pid) → block or allow
    └────┬────┘
         │
         ▼
┌─────────────────┐
│  Audit Record    │──▶ { timestamp, pid, app, action, element, risk, allowed }
└─────────────────┘
```

### Retry with Backoff

```
Operation
  │
  ▼
Attempt 1 ──▶ Success? → Return
  │ fail
  │ Retryable? (ECONNRESET, timeout, EPIPE, socket hang up)
  │    No → Throw immediately
  │    Yes ↓
  ▼
Wait: baseDelay × 2^attempt + jitter (0-30%)
  │
Attempt 2 ──▶ Success? → Return
  │ fail
  ▼
Wait: longer delay
  │
Attempt 3 ──▶ Success? → Return
  │ fail
  ▼
Throw (max retries exhausted)
```

---

## Session Bridge

UAB needs to interact with desktop windows, but agents often run in **Session 0** (non-interactive — SSH, Windows Services, Task Scheduler). Desktop windows live in **Session 1+**.

### The Problem

```
Session 0 (SSH/Service)          Session 1 (Desktop)
┌──────────────────┐            ┌──────────────────┐
│  UAB Service     │     ✗      │  Excel, VS Code  │
│  PowerShell      │────────    │  Window handles   │
│  UIA calls fail  │            │  UI elements      │
└──────────────────┘            └──────────────────┘
```

### The Solution

```
Session 0                        Session 1
┌──────────────────┐            ┌──────────────────┐
│  UAB Service     │            │                  │
│                  │  schtasks   │  Scheduled Task  │
│  Create task ────┼──/create──▶│  runs with /IT   │
│  with /IT flag   │  /IT       │  flag             │
│                  │            │                  │
│  Read result ◀───┼── temp ────│  Write to temp   │
│  from temp file  │   file     │  file            │
└──────────────────┘            └──────────────────┘
```

`ps-exec.ts` detects Session 0 automatically and routes PowerShell execution through the Task Scheduler bridge, making UAB work transparently regardless of how the agent process was launched.

---

## Key Design Decisions

See [docs/design-decisions.md](docs/design-decisions.md) for the full rationale behind:
- Why cascade instead of single-method
- Why DLL scanning instead of window class matching
- Why PowerShell for UIA instead of native bindings
- Why stateless CLI + stateful service (not one or the other)
