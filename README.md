# Universal App Bridge (UAB)

**Framework-level desktop app control for AI agents.**

Hook into UI frameworks to get structured, reliable access to any desktop application's interface — no cooperation from app developers required.

## The Problem

AI agents need to control local applications, but most apps expose no programmatic interface. Accessibility APIs are unreliable, vision+click is slow and brittle. UAB hooks at the **UI toolkit level** — intercepting the framework's own introspection and debug capabilities for agent control.

## Supported Frameworks

| Framework | Plugin | Apps Covered |
|-----------|--------|-------------|
| **Chrome/Edge/Brave** | Extension Bridge (WebSocket) | Any Chromium browser — tabs, cookies, DOM, storage, JS exec |
| **Chrome/Edge/Brave** | CDP Fallback | Same browsers, requires `--remote-debugging-port` |
| **Electron** | Chrome DevTools Protocol | VS Code, Slack, Discord, Notion, Obsidian, Spotify, Teams |
| **Qt 5/6** | UIA Bridge | VLC, Telegram Desktop, OBS Studio, VirtualBox, Wireshark |
| **GTK 3/4** | UIA Bridge | GIMP, Inkscape, GNOME apps |
| **WPF/.NET** | Windows UI Automation | Windows enterprise apps, Visual Studio |
| **Flutter** | UIA Bridge | Google apps, Ubuntu desktop apps |
| **Java Swing/FX** | JAB→UIA Bridge | JetBrains IDEs, Android Studio |
| **MS Office** | COM Automation | Word, Excel, PowerPoint, Outlook |
| **Win32** | Windows UI Automation | Universal fallback for any Windows app |

## Quick Start

### As a Library

```typescript
import { uab } from 'universal-app-bridge';

// Start the service
await uab.start();

// Discover running apps
const apps = await uab.detect();
console.log(apps);
// [{ pid: 1234, name: 'Slack', framework: 'electron', confidence: 0.9 }]

// Connect to an app
await uab.connect(apps[0]);

// Find all buttons
const buttons = await uab.query(apps[0].pid, { type: 'button' });

// Click one
await uab.act(apps[0].pid, buttons[0].id, 'click');

// Get app state
const state = await uab.state(apps[0].pid);

// Cleanup
await uab.stop();
```

### As a CLI (for AI agents)

The CLI outputs pure JSON, designed for Claude/GPT/any AI agent calling via bash:

```bash
# Scan for controllable apps
uab detect

# Connect and enumerate UI
uab connect Slack
uab enumerate 1234

# Find specific elements
uab query 1234 --type button --label "Send"

# Perform actions
uab act 1234 btn_42 click
uab act 1234 input_7 type --text "Hello world"

# Keyboard input
uab keypress 1234 Enter
uab hotkey 1234 ctrl+s

# Window management
uab window 1234 maximize
uab screenshot 1234 --output screen.png

# Get app state
uab state 1234
```

## Unified API

Every framework plugin maps its native UI tree into the same types:

### `uab.detect()` — Discover Apps

```typescript
const apps: DetectedApp[] = await uab.detect();
// { pid, name, path, framework, confidence, windowTitle }
```

### `uab.enumerate(pid)` — List UI Elements

```typescript
const elements: UIElement[] = await uab.enumerate(pid);
// Each element has: id, type, label, properties, bounds, children, actions, visible, enabled
```

### `uab.query(pid, selector)` — Search Elements

```typescript
// By type
const buttons = await uab.query(pid, { type: 'button' });

// By label (fuzzy match)
const submit = await uab.query(pid, { label: 'Submit' });

// Combined
const sendBtn = await uab.query(pid, { type: 'button', label: 'Send' });

// With constraints
const visible = await uab.query(pid, { type: 'textfield', visible: true, limit: 5 });
```

### `uab.act(pid, elementId, action, params?)` — Perform Actions

```typescript
await uab.act(pid, 'btn_1', 'click');
await uab.act(pid, 'input_3', 'type', { text: 'Hello' });
await uab.act(pid, 'select_5', 'select', { value: 'Option A' });
await uab.act(pid, 'elem_2', 'scroll', { direction: 'down', amount: 3 });
```

**Supported actions:** `click`, `doubleclick`, `rightclick`, `type`, `clear`, `select`, `scroll`, `focus`, `hover`, `expand`, `collapse`, `invoke`, `check`, `uncheck`, `toggle`, `keypress`, `hotkey`, `minimize`, `maximize`, `restore`, `close`, `move`, `resize`, `screenshot`

### `uab.state(pid)` — Get App State

```typescript
const state: AppState = await uab.state(pid);
// { window: { title, size, position, focused }, activeElement, modals, menus }
```

## Chrome Extension Bridge

UAB includes a Chrome Extension that connects to your running browser via WebSocket — **no browser relaunch required**. This is the preferred method for browser automation.

### How It Works

```
┌────────────────────┐    WebSocket     ┌────────────────────┐
│   UAB Service      │◄───(port 8787)──►│  Chrome Extension  │
│   (Node.js)        │    JSON protocol │  (Manifest V3)     │
└────────────────────┘                  └────────────────────┘
                                               │
                                        chrome.tabs / cookies
                                        chrome.scripting APIs
                                               │
                                        ┌──────▼─────────────┐
                                        │  Chrome / Edge /   │
                                        │  Brave Browser     │
                                        └────────────────────┘
```

### Installation

1. Start UAB (`uab.start()` or `uab detect`)
2. Open Chrome → `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked** → select `data/chrome-extension/`
5. The extension auto-connects via WebSocket — done!

The extension persists across browser restarts and auto-reconnects when UAB restarts.

### Browser Actions

The extension bridge supports these additional actions beyond standard UAB:

| Action | Description | Params |
|--------|-------------|--------|
| `getTabs` | List all open tabs | — |
| `newTab` | Open a new tab | `{ url }` |
| `closeTab` | Close a tab | `{ tabId }` |
| `switchTab` | Activate a tab | `{ tabId }` |
| `navigate` | Navigate to URL | `{ url }` |
| `goBack` / `goForward` | Browser history | — |
| `getCookies` | Read cookies | `{ domain?, url?, cookieName? }` |
| `setCookie` | Set a cookie | `{ url, cookieName, cookieValue, ... }` |
| `deleteCookie` / `clearCookies` | Remove cookies | `{ url?, cookieName?, domain? }` |
| `getLocalStorage` / `setLocalStorage` | localStorage ops | `{ storageKey, storageValue? }` |
| `getSessionStorage` / `setSessionStorage` | sessionStorage ops | `{ storageKey, storageValue? }` |
| `executeScript` | Run JavaScript in page | `{ script }` |
| `screenshot` | Capture visible tab | `{ outputPath? }` |

### Fallback Strategy

If the extension is not installed, UAB automatically falls back to the CDP-based `BrowserPlugin` which requires the browser to be relaunched with `--remote-debugging-port`.

```
Priority 1: Chrome Extension Bridge (no relaunch needed)
Priority 2: CDP Browser Plugin (requires debug flag)
```

## Advanced Features

### Action Chains

Multi-step workflows with verification between steps:

```typescript
import { ChainExecutor } from 'universal-app-bridge';

const chain = {
  name: 'fill-form',
  steps: [
    { type: 'action', elementId: 'name_input', action: 'type', params: { text: 'John' } },
    { type: 'action', elementId: 'email_input', action: 'type', params: { text: 'john@example.com' } },
    { type: 'wait', selector: { type: 'button', label: 'Submit' }, timeoutMs: 5000 },
    { type: 'action', elementId: 'submit_btn', action: 'click' },
  ],
};

const result = await uab.executeChain(chain);
```

### Control Router (Fallback Strategy)

UAB automatically selects the best control method with fallback:

```
Priority 1: Chrome Extension Bridge (browsers — no relaunch)
Priority 2: CDP Browser Plugin (browsers — with debug flag)
Priority 3: Direct API / Framework Hook (Electron CDP, etc.)
Priority 4: Windows UI Automation (universal fallback)
```

### Smart Caching

Element trees are cached with intelligent invalidation:
- Tree cache: 5s TTL per PID
- Query cache: 3s TTL, max 50 per PID
- Automatic invalidation on mutating actions (click, type, etc.)

### Permission & Safety Model

Built-in safety controls for agent use:
- **Risk levels:** safe, moderate, destructive
- **Rate limiting:** 100 actions/min per PID (configurable)
- **Audit log:** Last 1000 actions with timestamps
- **Destructive action gating:** `close` requires confirmation

### Health Monitoring

Connection lifecycle management:
- 30-second health check intervals
- Auto-reconnect with exponential backoff (1s → 2s → 4s → 8s max)
- Stale connection cleanup after 5 minutes of failure
- Event callbacks for connection state changes

## Element Types

UAB normalizes all framework-specific element types into a unified set:

`window`, `button`, `textfield`, `textarea`, `checkbox`, `radio`, `select`, `menu`, `menuitem`, `list`, `listitem`, `table`, `tablerow`, `tablecell`, `tab`, `tabpanel`, `tree`, `treeitem`, `slider`, `progressbar`, `scrollbar`, `toolbar`, `statusbar`, `dialog`, `tooltip`, `image`, `link`, `label`, `heading`, `separator`, `container`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `UAB_LOG_LEVEL` | `info` | Log level: `debug`, `info`, `warn`, `error` |
| `UAB_LOG_FILE` | _(none)_ | Optional file path for log output |
| `LOG_LEVEL` | `info` | Fallback log level (if UAB_LOG_LEVEL not set) |

## Requirements

- **Node.js** >= 18.0.0
- **Windows** (primary platform — UIA, COM, PowerShell)
- Linux/macOS support via framework-specific plugins

## Architecture

```
Agent Runtime (Claude / GPT / Any Agent)
         |
         v
┌─────────────────────────────────┐
│    Universal App Bridge (UAB)   │
│                                 │
│  ┌───────────┐  ┌────────────┐  │
│  │ Framework  │  │  Control   │  │
│  │ Detector   │──│  Router    │  │
│  └───────────┘  └────────────┘  │
│         |              |        │
│  ┌──────┴──────────────┴──────┐ │
│  │     Framework Plugins      │ │
│  │ Chrome Ext  Browser (CDP)  │ │
│  │ Electron  Qt  GTK  WPF     │ │
│  │ Flutter  Java  Office      │ │
│  └────────────────────────────┘ │
│         |                       │
│  ┌──────┴─────────────────────┐ │
│  │       Unified API          │ │
│  │ enumerate() query() act()  │ │
│  │ state() subscribe()       │ │
│  └────────────────────────────┘ │
│                                 │
│  ┌────────────────────────────┐ │
│  │   Production Hardening     │ │
│  │ Cache  Permissions  Health │ │
│  │ Retry  Chains  Audit Log   │ │
│  └────────────────────────────┘ │
└─────────────────────────────────┘
```

## License

Universal App Bridge is licensed under the **Business Source License 1.1**.

**Permitted:** Personal use, academic research, evaluation, testing,
open source projects, and use within the Lancelot ecosystem.

**Requires commercial license:** Commercial agent runtimes, SaaS
platforms, enterprise internal use (25+ employees), competing
products, and deployments to 5+ users/devices.

**Patent notice:** This software is subject to pending patent
applications. The Change Date license conversion does not grant
patent rights beyond those stated in the License.

Each version converts to Apache 2.0 four years after release.

See [LICENSE](./LICENSE) for full terms.
