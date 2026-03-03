# API Reference

Complete reference for every public interface in Universal App Bridge.

> Auto-generated from source: `src/uab/`. All types, methods, parameters, and return values documented.

---

## Table of Contents

- [UABService](#uabservice) — Main service singleton
- [Types](#types) — Core type definitions
- [ElementCache](#elementcache) — Smart caching
- [PermissionManager](#permissionmanager) — Safety & audit
- [ConnectionManager](#connectionmanager) — Health monitoring
- [ChainExecutor](#chainexecutor) — Multi-step workflows
- [Retry Utilities](#retry-utilities) — Error recovery
- [CLI Commands](#cli-commands) — Command-line interface
- [FrameworkDetector](#frameworkdetector) — Process scanning
- [ControlRouter](#controlrouter) — Method cascading
- [PluginManager](#pluginmanager) — Plugin registry

---

## UABService

**Import:** `import { uab } from 'universal-app-bridge'`

The main entry point. Singleton instance that manages the full lifecycle.

### Lifecycle

#### `start(): Promise<void>`
Initialize UAB service. Registers all plugins, starts health monitoring.

#### `stop(): Promise<void>`
Disconnect all connections, stop health monitoring, clean up resources.

#### `running: boolean`
Whether the service is currently active.

---

### Discovery

#### `detect(): Promise<DetectedApp[]>`
Scan for all controllable desktop applications.

**Returns:** Array of detected apps with PID, name, framework, confidence score.

```typescript
const apps = await uab.detect();
// [{ pid: 1234, name: 'Slack', framework: 'electron', confidence: 0.9, path: '...', windowTitle: '...' }]
```

#### `detectElectron(): Promise<DetectedApp[]>`
Scan for Electron apps only (faster, targeted).

#### `detectByPid(pid: number): Promise<DetectedApp | null>`
Check if a specific PID is a controllable app.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pid` | `number` | Process ID to check |

#### `findByName(name: string): Promise<DetectedApp[]>`
Find apps by name (fuzzy, case-insensitive match).

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | App name to search for |

---

### Connection

#### `connect(app: DetectedApp): Promise<{ method: string; pid: number }>`
Connect to a detected application. UAB selects the best control method automatically.

| Parameter | Type | Description |
|-----------|------|-------------|
| `app` | `DetectedApp` | App object from `detect()` |

**Returns:** `{ method: string, pid: number }` — the control method used and PID.

#### `connectByName(name: string): Promise<{ method: string; pid: number; app: DetectedApp }>`
Convenience method: detect + find + connect in one call.

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | App name (fuzzy match) |

#### `disconnect(pid: number): Promise<void>`
Disconnect from a specific app.

#### `disconnectAll(): Promise<void>`
Disconnect from all connected apps.

#### `isConnected(pid: number): boolean`
Check if currently connected to a PID.

#### `getConnections(): Array<{ pid: number; name: string; framework: string; method: string }>`
List all active connections.

---

### Core API

#### `enumerate(pid: number): Promise<UIElement[]>`
Get the full UI element tree for a connected app. Results are cached (5s TTL).

| Parameter | Type | Description |
|-----------|------|-------------|
| `pid` | `number` | Process ID of connected app |

**Returns:** Array of `UIElement` objects in tree structure.

#### `query(pid: number, selector: ElementSelector): Promise<UIElement[]>`
Search for specific elements. Results are cached (3s TTL).

| Parameter | Type | Description |
|-----------|------|-------------|
| `pid` | `number` | Process ID of connected app |
| `selector` | `ElementSelector` | Search criteria (see below) |

**ElementSelector:**

| Field | Type | Description |
|-------|------|-------------|
| `type` | `ElementType` | Element type filter (e.g., `'button'`, `'textfield'`) |
| `label` | `string` | Label text filter (exact or regex) |
| `properties` | `Record<string, unknown>` | Property value filters |
| `visible` | `boolean` | Visibility filter |
| `enabled` | `boolean` | Enabled state filter |
| `limit` | `number` | Max results to return |

```typescript
// Find all visible buttons with "Save" in the label
const btns = await uab.query(pid, {
  type: 'button',
  label: 'Save',
  visible: true,
  limit: 5
});
```

#### `act(pid: number, elementId: string, action: ActionType, params?: ActionParams): Promise<ActionResult>`
Perform an action on a UI element. Permission-checked, retried on transient failure, cache-invalidating.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pid` | `number` | Process ID |
| `elementId` | `string` | Target element ID (from enumerate/query) |
| `action` | `ActionType` | Action to perform (see action list below) |
| `params` | `ActionParams` | Optional action parameters |

**ActionParams:**

| Field | Type | Used By |
|-------|------|---------|
| `text` | `string` | `type` |
| `value` | `string` | `select`, `writeCell` |
| `direction` | `'up' \| 'down' \| 'left' \| 'right'` | `scroll` |
| `amount` | `number` | `scroll` |
| `x` | `number` | `move` |
| `y` | `number` | `move` |
| `width` | `number` | `resize` |
| `height` | `number` | `resize` |
| `cell` | `string` | `readCell`, `writeCell`, `readFormula` |
| `range` | `string` | `readRange`, `writeRange` |
| `sheet` | `string` | Excel sheet name |
| `url` | `string` | `navigate`, `setCookie`, `deleteCookie` |
| `name` | `string` | `setCookie`, `deleteCookie` |
| `domain` | `string` | `setCookie`, `deleteCookie`, `clearCookies` |
| `secure` | `boolean` | `setCookie` |
| `httpOnly` | `boolean` | `setCookie` |
| `sameSite` | `'Strict' \| 'Lax' \| 'None'` | `setCookie` |
| `expires` | `number` | `setCookie` (Unix timestamp) |
| `key` | `string` | `setLocalStorage`, `deleteLocalStorage`, etc. |
| `javascript` | `string` | `executeScript` |
| `tabId` | `string` | `switchTab`, `closeTab` |

**ActionResult:**

```typescript
{
  success: boolean;
  data?: unknown;      // Return data (cell values, document text, etc.)
  error?: string;      // Error message if failed
  method?: string;     // Control method used
}
```

#### `state(pid: number): Promise<AppState>`
Get current application state. Cached (2s TTL).

**AppState:**

```typescript
{
  window?: {
    title: string;
    size: { width: number; height: number };
    position: { x: number; y: number };
    focused: boolean;
  };
  activeElement?: UIElement;
  modals?: UIElement[];
  menus?: UIElement[];
}
```

---

### Keyboard Input

#### `keypress(pid: number, key: string): Promise<ActionResult>`
Send a single keypress to the app.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pid` | `number` | Process ID |
| `key` | `string` | Key name (e.g., `'Enter'`, `'Tab'`, `'F5'`, `'Escape'`) |

#### `hotkey(pid: number, keys: string[]): Promise<ActionResult>`
Send a key combination.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pid` | `number` | Process ID |
| `keys` | `string[]` | Key names (e.g., `['ctrl', 's']`, `['alt', 'F4']`) |

---

### Window Management

#### `minimize(pid: number): Promise<ActionResult>`
#### `maximize(pid: number): Promise<ActionResult>`
#### `restore(pid: number): Promise<ActionResult>`
#### `closeWindow(pid: number): Promise<ActionResult>`
#### `moveWindow(pid: number, x: number, y: number): Promise<ActionResult>`
#### `resizeWindow(pid: number, width: number, height: number): Promise<ActionResult>`
#### `screenshot(pid: number, outputPath?: string): Promise<ActionResult>`

| Parameter | Type | Description |
|-----------|------|-------------|
| `pid` | `number` | Process ID |
| `x`, `y` | `number` | New position (for `moveWindow`) |
| `width`, `height` | `number` | New size (for `resizeWindow`) |
| `outputPath` | `string` | File path for screenshot (default: `data/screenshots/`) |

---

### Advanced

#### `executeChain(chain: ChainDefinition): Promise<ChainResult>`
Execute a multi-step action workflow. See [ChainExecutor](#chainexecutor).

#### `getHealthSummary(): Array<HealthEntry>`
Get health status of all connections.

```typescript
// { pid: number, name: string, healthy: boolean, uptimeMs: number, failures: number, method: string }
```

#### `getCacheStats(): CacheStats`
Get cache performance statistics.

#### `getAuditLog(limit?: number): AuditEntry[]`
Get recent action audit log. Default limit: 50.

#### `countElements(elements: UIElement[]): number`
Count total elements in a tree (including nested children).

#### `flattenTree(elements: UIElement[], maxDepth?: number): Array<{ depth: number; element: UIElement }>`
Flatten a nested element tree into a flat list with depth info.

---

## Types

### UIElement

```typescript
interface UIElement {
  id: string;                          // Unique element identifier
  type: ElementType;                   // Normalized element type
  label: string;                       // Display text / accessible name
  properties: Record<string, unknown>; // Framework-specific properties
  bounds: Bounds;                      // { x, y, width, height }
  children: UIElement[];               // Nested child elements
  actions: ActionType[];               // Available actions
  visible: boolean;                    // Whether element is visible
  enabled: boolean;                    // Whether element is enabled/interactive
  meta?: Record<string, unknown>;      // Plugin-specific metadata
}
```

### ElementType (42 types)

**Containers:** `window`, `dialog`, `container`, `toolbar`, `statusbar`, `tabpanel`

**Input:** `textfield`, `textarea`, `checkbox`, `radio`, `select`, `slider`, `spinner`

**Lists:** `list`, `listitem`, `table`, `tablerow`, `tablecell`, `tree`, `treeitem`

**Navigation:** `menu`, `menuitem`, `tab`, `link`

**Display:** `label`, `heading`, `image`, `separator`, `progressbar`, `scrollbar`, `tooltip`

**Special:** `unknown`

### ActionType (61 types)

**Click/Interact:** `click`, `doubleclick`, `rightclick`, `focus`, `hover`

**Text:** `type`, `clear`, `select`

**Toggle:** `check`, `uncheck`, `toggle`, `expand`, `collapse`

**Invoke:** `invoke`, `contextmenu`

**Keyboard:** `keypress`, `hotkey`

**Window:** `minimize`, `maximize`, `restore`, `close`, `move`, `resize`, `screenshot`

**Office:** `readDocument`, `readCell`, `writeCell`, `readRange`, `writeRange`, `getSheets`, `readFormula`, `readSlides`, `readSlideText`, `readEmails`, `composeEmail`, `sendEmail`

**Browser:** `navigate`, `goBack`, `goForward`, `reload`, `getTabs`, `switchTab`, `closeTab`, `newTab`, `getCookies`, `setCookie`, `deleteCookie`, `clearCookies`, `getLocalStorage`, `setLocalStorage`, `deleteLocalStorage`, `clearLocalStorage`, `getSessionStorage`, `setSessionStorage`, `deleteSessionStorage`, `clearSessionStorage`, `executeScript`

### DetectedApp

```typescript
interface DetectedApp {
  pid: number;              // Process ID
  name: string;             // Application name
  path?: string;            // Executable path
  framework: FrameworkType; // Detected framework
  confidence: number;       // Detection confidence (0-1)
  windowTitle?: string;     // Main window title
  commandLine?: string;     // Process command line
  modules?: string[];       // Loaded DLL modules
}
```

### FrameworkType

```typescript
type FrameworkType =
  | 'electron' | 'browser' | 'qt5' | 'qt6'
  | 'gtk3' | 'gtk4' | 'macos-native' | 'wpf'
  | 'winui' | 'dotnet' | 'flutter'
  | 'java-swing' | 'javafx' | 'office' | 'unknown';
```

### ControlMethod

```typescript
type ControlMethod = 'direct-api' | 'uab-hook' | 'accessibility' | 'vision';
```

### Bounds

```typescript
interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

---

## ElementCache

**Import:** `import { ElementCache } from 'universal-app-bridge'`

Smart caching layer with TTL and intelligent invalidation.

### Constructor

```typescript
new ElementCache(options?: CacheOptions)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `treeTtl` | `number` | `5000` | Tree cache TTL in ms |
| `queryTtl` | `number` | `3000` | Query cache TTL in ms |
| `stateTtl` | `number` | `2000` | State cache TTL in ms |
| `maxQueriesPerPid` | `number` | `50` | Max cached queries per PID |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getTree(pid)` | `UIElement[] \| null` | Get cached tree |
| `setTree(pid, tree)` | `void` | Store tree |
| `getQuery(pid, selector)` | `UIElement[] \| null` | Get cached query result |
| `setQuery(pid, selector, results)` | `void` | Store query result |
| `getState(pid)` | `unknown \| null` | Get cached state |
| `setState(pid, state)` | `void` | Store state |
| `invalidate(pid)` | `void` | Clear all cache for a PID |
| `invalidateIfNeeded(pid, action)` | `void` | Clear if action is mutating |
| `shouldInvalidate(action)` | `boolean` | Check if action type is mutating |
| `clear()` | `void` | Clear entire cache |
| `remove(pid)` | `void` | Remove specific PID |
| `getStats()` | `CacheStats` | Get hit/miss statistics |
| `getHitRate()` | `number` | Hit rate as percentage |

### CacheStats

```typescript
{
  treeCacheSize: number;
  queryCacheSize: number;
  stateCacheSize: number;
  totalHits: number;
  totalMisses: number;
  invalidations: number;
}
```

---

## PermissionManager

**Import:** `import { PermissionManager } from 'universal-app-bridge'`

Safety model with risk classification, rate limiting, and audit logging.

### Constructor

```typescript
new PermissionManager(options?: PermissionOptions)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `blockDestructive` | `boolean` | `false` | Block destructive actions |
| `rateLimit` | `number` | `100` | Max actions per window |
| `rateLimitWindow` | `number` | `60000` | Rate limit window in ms |
| `maxAuditEntries` | `number` | `1000` | Max audit log entries |
| `exemptPids` | `Set<number>` | `new Set()` | PIDs exempt from rate limiting |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `check(pid, action, app?)` | `PermissionCheck` | Check if action is allowed |
| `record(pid, action, elementId, app, allowed, reason?)` | `void` | Record action to audit log |
| `confirmDestructive(pid)` | `void` | Pre-approve destructive actions for PID |
| `revokeDestructive(pid)` | `void` | Revoke destructive approval |
| `getRiskLevel(action)` | `RiskLevel` | Get risk classification |
| `getAuditLog(limit?)` | `AuditEntry[]` | Get recent audit entries |
| `getAuditForPid(pid, limit?)` | `AuditEntry[]` | Get audit for specific PID |
| `getRateLimitStatus(pid)` | `RateLimitStatus` | Check rate limit status |
| `clear()` | `void` | Clear all state |

### Risk Levels

| Level | Actions | Default Behavior |
|-------|---------|-----------------|
| `safe` | click, scroll, focus, hover, screenshot, window mgmt | Always allowed |
| `moderate` | type, select, check, uncheck, toggle, keypress, hotkey | Allowed, logged |
| `destructive` | close | Allowed by default, optionally blocked |

### PermissionCheck

```typescript
{ allowed: boolean; riskLevel: RiskLevel; reason?: string }
```

### AuditEntry

```typescript
{
  timestamp: number;
  pid: number;
  appName: string;
  action: ActionType;
  elementId: string;
  riskLevel: RiskLevel;
  allowed: boolean;
  reason?: string;
}
```

---

## ConnectionManager

**Import:** `import { ConnectionManager } from 'universal-app-bridge'`

Health monitoring with auto-reconnect and stale cleanup.

### Constructor

```typescript
new ConnectionManager(router: ControlRouter, options?: ConnectionManagerOptions)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `healthCheckInterval` | `number` | `30000` | Health check interval in ms |
| `maxHealthFailures` | `number` | `3` | Failures before reconnect |
| `maxReconnectAttempts` | `number` | `3` | Max reconnect attempts |
| `staleTimeout` | `number` | `300000` | Remove after 5 min unhealthy |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `startMonitoring()` | `void` | Begin periodic health checks |
| `stopMonitoring()` | `void` | Stop health checks |
| `track(pid, app, connection)` | `void` | Register a connection |
| `untrack(pid, reason?)` | `void` | Remove a connection |
| `get(pid)` | `ConnectionEntry \| undefined` | Get connection entry |
| `getAll()` | `ConnectionEntry[]` | Get all entries |
| `getHealthSummary()` | `HealthEntry[]` | Summary of all connections |
| `runHealthChecks()` | `Promise<void>` | Manual health check |
| `onEvent(callback)` | `() => void` | Subscribe to events (returns unsubscribe) |
| `shutdown()` | `Promise<void>` | Stop monitoring, disconnect all |

### Connection Events

| Event Type | Fields | Description |
|-----------|--------|-------------|
| `connected` | `pid, app, method` | New connection established |
| `disconnected` | `pid, reason` | Connection dropped |
| `reconnecting` | `pid, attempt` | Attempting reconnect |
| `reconnected` | `pid, method` | Successfully reconnected |
| `health-check-failed` | `pid, error, failures` | Health check failed |
| `stale-removed` | `pid` | Removed after timeout |

---

## ChainExecutor

**Import:** `import { ChainExecutor } from 'universal-app-bridge'`

Multi-step action workflow engine with conditional branching and verification.

### `execute(chain: ChainDefinition): Promise<ChainResult>`

Execute a chain of steps sequentially.

### ChainDefinition

```typescript
{
  name: string;            // Chain name (for logging)
  pid: number;             // Target process
  steps: ChainStep[];      // Steps to execute
  stopOnError?: boolean;   // Stop on first error (default: true)
  stepDelay?: number;      // Delay between steps in ms (default: 200)
}
```

### Step Types

#### ActionStep
```typescript
{ type: 'action'; selector: ElementSelector; action: ActionType; params?: ActionParams; label?: string }
```
Find element matching selector and perform action.

#### WaitStep
```typescript
{ type: 'wait'; selector: ElementSelector; timeoutMs?: number; pollMs?: number; waitForAbsence?: boolean; label?: string }
```
Poll until element appears (or disappears). Default timeout: 10s, poll interval: 500ms.

#### ConditionalStep
```typescript
{ type: 'conditional'; selector: ElementSelector; ifPresent: ChainStep[]; ifAbsent?: ChainStep[]; label?: string }
```
Branch based on element presence.

#### DelayStep
```typescript
{ type: 'delay'; ms: number; label?: string }
```

#### KeypressStep
```typescript
{ type: 'keypress'; key: string; label?: string }
```

#### HotkeyStep
```typescript
{ type: 'hotkey'; keys: string[]; label?: string }
```

#### TypeTextStep
```typescript
{ type: 'typeText'; selector: ElementSelector; text: string; clearFirst?: boolean; label?: string }
```

### ChainResult

```typescript
{
  name: string;
  success: boolean;
  stepsCompleted: number;
  totalSteps: number;
  steps: StepResult[];
  durationMs: number;
  error?: string;
}
```

### Pre-built Templates

#### `buildFormChain(pid, name, fields, submitSelector?): ChainDefinition`

Build a chain that fills out a form and optionally submits it.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pid` | `number` | Target process |
| `name` | `string` | Chain name |
| `fields` | `Array<{ selector, value, clearFirst? }>` | Form fields |
| `submitSelector` | `ElementSelector` | Optional submit button |

#### `buildMenuChain(pid, name, menuPath): ChainDefinition`

Build a chain that navigates a menu hierarchy.

| Parameter | Type | Description |
|-----------|------|-------------|
| `pid` | `number` | Target process |
| `name` | `string` | Chain name |
| `menuPath` | `string[]` | Menu labels to click (e.g., `['File', 'Save As...']`) |

---

## Retry Utilities

**Import:** `import { withRetry, withTimeout, isRetryable } from 'universal-app-bridge'`

### `withRetry<T>(operation, options?): Promise<T>`

Execute an operation with retry on transient failure.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxRetries` | `number` | `2` | Maximum retry attempts |
| `baseDelay` | `number` | `500` | Base delay in ms |
| `maxDelay` | `number` | `5000` | Maximum delay in ms |
| `jitter` | `boolean` | `true` | Add 0-30% random jitter |
| `timeout` | `number` | `30000` | Per-attempt timeout in ms |
| `shouldRetry` | `(error, attempt) => boolean` | Auto | Custom retry predicate |
| `label` | `string` | `'operation'` | Label for logging |

**Retryable patterns:** `timeout`, `EPIPE`, `ECONNRESET`, `ECONNREFUSED`, `socket hang up`, `powershell exited`, `process not found`, `not responding`

### `withTimeout<T>(operation, timeoutMs, label?): Promise<T>`

Execute with a timeout. Throws if operation exceeds time limit.

### `isRetryable(error: Error): boolean`

Check if an error matches retryable patterns.

---

## CLI Commands

All commands output JSON. Usage: `node dist/uab/cli.js <command> [args]`

### Discovery & Connection

| Command | Args | Description |
|---------|------|-------------|
| `detect` | `[--electron]` | List detected apps |
| `connect` | `<name\|pid>` | Connect and return info |
| `state` | `<pid>` | Get app state |

### UI Interaction

| Command | Args | Description |
|---------|------|-------------|
| `enumerate` | `<pid> [--depth N]` | Get flattened UI tree |
| `query` | `<pid> [--type T] [--label L] [--limit N]` | Search elements |
| `act` | `<pid> <elementId> <action> [--text T] [--value V]` | Perform action |

### Keyboard

| Command | Args | Description |
|---------|------|-------------|
| `keypress` | `<pid> <key>` | Send keypress |
| `hotkey` | `<pid> <key1+key2+...>` | Send hotkey |

### Window

| Command | Args | Description |
|---------|------|-------------|
| `window` | `<pid> min\|max\|restore\|close` | Window control |
| `window` | `<pid> move --x N --y N` | Move window |
| `window` | `<pid> resize --width N --height N` | Resize window |
| `screenshot` | `<pid> [--output path]` | Capture screenshot |

### Browser

| Command | Args | Description |
|---------|------|-------------|
| `navigate` | `<pid> <url>` | Navigate to URL |
| `tabs` | `<pid>` | List tabs |
| `switchtab` | `<pid> <tabId>` | Switch tab |
| `newtab` | `<pid> [url]` | Open new tab |
| `closetab` | `<pid> [tabId]` | Close tab |
| `cookies` | `<pid> [--name N] [--domain D]` | Get cookies |
| `setcookie` | `<pid> --name N --value V [opts]` | Set cookie |
| `deletecookie` | `<pid> --name N [--domain D]` | Delete cookie |
| `clearcookies` | `<pid> [--domain D]` | Clear all cookies |
| `storage` | `<pid> [--type local\|session] [--action get\|set\|delete\|clear] [--key K] [--value V]` | Web storage |
| `exec` | `<pid> "<javascript>"` | Execute JavaScript |

### Workflows

| Command | Args | Description |
|---------|------|-------------|
| `chain` | `<json>` or `--json '{...}'` | Execute action chain |

### Chrome Extension

| Command | Args | Description |
|---------|------|-------------|
| `ext-status` | — | Check extension bridge status |
| `ext-install` | — | Generate icons + install guide |

### Utility

| Command | Args | Description |
|---------|------|-------------|
| `help` | — | Show all commands |

---

## FrameworkDetector

**Import:** `import { FrameworkDetector } from 'universal-app-bridge'`

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `detectAll()` | `Promise<DetectedApp[]>` | Scan all running processes |
| `detectElectron()` | `Promise<DetectedApp[]>` | Electron apps only |
| `detectByPid(pid)` | `Promise<DetectedApp \| null>` | Check specific PID |
| `findByName(name)` | `Promise<DetectedApp[]>` | Search by name |
| `clearCache()` | `void` | Clear detection cache |

---

## ControlRouter

**Import:** `import { ControlRouter } from 'universal-app-bridge'`

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `connect(app)` | `Promise<RoutedConnection>` | Connect with best method |
| `getRoute(pid)` | `ControlRoute \| undefined` | Get current route |
| `disconnect(pid)` | `Promise<void>` | Disconnect |
| `disconnectAll()` | `Promise<void>` | Disconnect all |
| `fallback(pid)` | `Promise<RoutedConnection \| null>` | Try next method |

---

## PluginManager

**Import:** `import { PluginManager } from 'universal-app-bridge'`

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `register(plugin)` | `void` | Register a framework plugin |
| `getRegisteredFrameworks()` | `FrameworkType[]` | List registered frameworks |
| `hasPlugin(framework)` | `boolean` | Check if plugin exists |
| `findPlugin(app)` | `FrameworkPlugin \| null` | Find matching plugin |
| `connect(app)` | `Promise<PluginConnection>` | Connect via matching plugin |
| `getConnection(pid)` | `PluginConnection \| undefined` | Get active connection |
| `disconnect(pid)` | `Promise<void>` | Disconnect |
| `disconnectAll()` | `Promise<void>` | Disconnect all |
| `getActiveConnections()` | `Array<{ pid, app, connected }>` | List active |

### FrameworkPlugin Interface

```typescript
interface FrameworkPlugin {
  readonly framework: FrameworkType;
  readonly name: string;
  canHandle(app: DetectedApp): boolean;
  connect(app: DetectedApp): Promise<PluginConnection>;
}
```

### PluginConnection Interface

```typescript
interface PluginConnection {
  enumerate(): Promise<UIElement[]>;
  query(selector: ElementSelector): Promise<UIElement[]>;
  act(elementId: string, action: ActionType, params?: ActionParams): Promise<ActionResult>;
  state(): Promise<AppState>;
  subscribe?(event: UABEventType, callback: UABEventCallback): Promise<Subscription>;
  disconnect(): Promise<void>;
  connected: boolean;
}
```
