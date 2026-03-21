/**
 * UABConnector — Framework-independent desktop app control.
 *
 * This is the public API that ANY agent framework can use:
 *   - Claude Code (via Bash → CLI)
 *   - Codex CLI (via Bash → CLI)
 *   - Custom agents (import as library)
 *   - MD-only agents (via CLI JSON output)
 *   - ClaudeClaw Telegram bot (via service mode)
 *
 * Design principles:
 *   - ZERO dependencies on any agent framework (no Grammy, no SQLite)
 *   - Instantiable (not singleton) — each consumer gets its own instance
 *   - In-memory registry for fast lookups, JSON profiles for persistence
 *   - Returns plain JSON-serializable objects
 *   - Scales to 1000+ apps (Map lookups, lazy scanning)
 *
 * @example
 * ```ts
 * // Library usage
 * import { UABConnector } from './uab/connector.js';
 *
 * const uab = new UABConnector();
 * await uab.start();
 * const apps = await uab.scan();
 * await uab.connect(apps[0].pid);
 * const buttons = await uab.query(apps[0].pid, { type: 'button' });
 * await uab.act(apps[0].pid, buttons[0].id, 'click');
 * await uab.stop();
 * ```
 *
 * @example
 * ```bash
 * # CLI usage (any agent framework)
 * node dist/uab/cli.js scan
 * node dist/uab/cli.js apps
 * node dist/uab/cli.js connect notepad
 * node dist/uab/cli.js query 1234 --type button
 * node dist/uab/cli.js act 1234 btn_1 click
 * ```
 */

import { detectEnvironment, getDefaults } from './environment.js';
import { FrameworkDetector } from './detector.js';
import { PluginManager } from './plugins/base.js';
import { ElectronPlugin } from './plugins/electron/index.js';
import { BrowserPlugin } from './plugins/browser/index.js';
import { ChromeExtPlugin } from './plugins/chrome-ext/index.js';
import { ExtensionWSServer } from './plugins/chrome-ext/ws-server.js';
import { WinUIAPlugin } from './plugins/win-uia/index.js';
import { QtPlugin } from './plugins/qt/index.js';
import { GtkPlugin } from './plugins/gtk/index.js';
import { JavaPlugin } from './plugins/java/index.js';
import { FlutterPlugin } from './plugins/flutter/index.js';
import { OfficePlugin } from './plugins/office/index.js';
import { ControlRouter } from './router.js';
import { ElementCache } from './cache.js';
import { PermissionManager } from './permissions.js';
import { withRetry } from './retry.js';
import { ConnectionManager } from './connection-manager.js';
import { AppRegistry } from './registry.js';
import type { AppProfile } from './registry.js';
import type {
  DetectedApp, UIElement, ElementSelector,
  ActionType, ActionParams, ActionResult, AppState,
} from './types.js';

// ─── Options ────────────────────────────────────────────────────

export interface ConnectorOptions {
  /** Directory for JSON profile persistence. Default: "data/uab-profiles" */
  profileDir?: string;
  /** Enable persistent connections with health monitoring. Default: auto-detected from environment */
  persistent?: boolean;
  /** Enable Chrome extension WebSocket bridge. Default: auto-detected from environment */
  extensionBridge?: boolean;
  /** Load existing profiles on start. Default: true */
  loadProfiles?: boolean;
  /** Max actions per minute per PID (rate limiting). Default: auto-detected from environment */
  rateLimit?: number;
  /** Force a specific runtime mode instead of auto-detecting. */
  mode?: 'desktop' | 'server' | 'container';
}

// ─── Connection Info ────────────────────────────────────────────

export interface ConnectionInfo {
  pid: number;
  name: string;
  framework: string;
  method: string;
  elementCount: number;
}

// ─── Connector ──────────────────────────────────────────────────

export class UABConnector {
  readonly registry: AppRegistry;

  private detector: FrameworkDetector;
  private pluginManager: PluginManager;
  private router: ControlRouter;
  private cache: ElementCache;
  private permissions: PermissionManager;

  // Optional persistent-mode modules
  private connectionMgr: ConnectionManager | null = null;
  private extensionServer: ExtensionWSServer | null = null;

  private opts: Required<Omit<ConnectorOptions, 'mode'>> & { mode: string };
  private started = false;

  constructor(options?: ConnectorOptions) {
    // Auto-detect environment defaults if not explicitly set
    const envDefaults = getDefaults(options?.mode ?? detectEnvironment().mode);

    this.opts = {
      profileDir: options?.profileDir || 'data/uab-profiles',
      persistent: options?.persistent ?? envDefaults.persistent,
      extensionBridge: options?.extensionBridge ?? envDefaults.extensionBridge,
      loadProfiles: options?.loadProfiles ?? true,
      rateLimit: options?.rateLimit ?? envDefaults.rateLimit,
      mode: options?.mode ?? detectEnvironment().mode,
    };

    this.registry = new AppRegistry({ profileDir: this.opts.profileDir });
    this.detector = new FrameworkDetector();
    this.pluginManager = new PluginManager();
    this.router = new ControlRouter(this.pluginManager);
    this.cache = new ElementCache();
    this.permissions = new PermissionManager({ rateLimit: this.opts.rateLimit });
  }

  // ─── Lifecycle ──────────────────────────────────────────────────

  /** Initialize the connector. Call before any other method. */
  async start(): Promise<void> {
    if (this.started) return;

    // Load saved profiles
    if (this.opts.loadProfiles) {
      this.registry.load();
    }

    // Extension bridge (optional)
    if (this.opts.extensionBridge) {
      this.extensionServer = new ExtensionWSServer();
      try {
        await this.extensionServer.start();
      } catch {
        this.extensionServer = null;
      }
    }

    // Register plugins (priority order: specific → generic)
    if (this.extensionServer) {
      this.pluginManager.register(new ChromeExtPlugin(this.extensionServer));
    }
    this.pluginManager.register(new BrowserPlugin());
    this.pluginManager.register(new ElectronPlugin());
    this.pluginManager.register(new OfficePlugin());
    this.pluginManager.register(new QtPlugin());
    this.pluginManager.register(new GtkPlugin());
    this.pluginManager.register(new JavaPlugin());
    this.pluginManager.register(new FlutterPlugin());
    this.pluginManager.register(new WinUIAPlugin());

    // Persistent mode: connection manager with health monitoring
    if (this.opts.persistent) {
      this.connectionMgr = new ConnectionManager(this.router);
      this.connectionMgr.startMonitoring();
    }

    this.started = true;
  }

  /** Stop the connector and release all resources. */
  async stop(): Promise<void> {
    if (!this.started) return;

    if (this.connectionMgr) {
      await this.connectionMgr.shutdown();
      this.connectionMgr = null;
    }
    if (this.extensionServer) {
      await this.extensionServer.stop();
      this.extensionServer = null;
    }

    await this.router.disconnectAll();
    this.cache.clear();
    this.permissions.clear();
    this.started = false;
  }

  /** Is the connector running? */
  get running(): boolean { return this.started; }

  // ─── Discovery ──────────────────────────────────────────────────

  /**
   * Scan for all controllable apps and register them.
   * Returns fresh profiles with live PIDs.
   */
  async scan(electronOnly = false): Promise<AppProfile[]> {
    this.ensureStarted();
    const detected = electronOnly
      ? await this.detector.detectElectron()
      : await this.detector.detectAll();

    return this.registry.registerAll(detected);
  }

  /**
   * List known apps from registry (no scan — instant).
   * Call scan() first to populate, or load() to restore saved profiles.
   */
  apps(): AppProfile[] {
    return this.registry.all();
  }

  /**
   * Search registry by name (fuzzy, case-insensitive).
   * If no results in registry, falls back to live detection.
   */
  async find(query: string): Promise<AppProfile[]> {
    this.ensureStarted();

    // Try registry first
    const cached = this.registry.byName(query);
    if (cached.length > 0) return cached;

    // Fall back to live detection
    const detected = await this.detector.findByName(query);
    if (detected.length === 0) return [];

    return detected.map(app => this.registry.register(app));
  }

  /** Inspect a specific PID. */
  async inspectPid(pid: number): Promise<AppProfile | null> {
    this.ensureStarted();

    // Check registry first
    const cached = this.registry.byPid(pid);
    if (cached) return cached;

    // Live detect
    const app = await this.detector.detectByPid(pid);
    if (!app) return null;

    return this.registry.register(app);
  }

  // ─── Connection ─────────────────────────────────────────────────

  /** Connect to an app by PID. Auto-detects if not in registry. */
  async connect(pid: number): Promise<ConnectionInfo>;
  /** Connect to an app by name. Searches registry, then live-detects. */
  async connect(name: string): Promise<ConnectionInfo>;
  async connect(target: number | string): Promise<ConnectionInfo> {
    this.ensureStarted();

    let app: DetectedApp;

    if (typeof target === 'number') {
      // PID-based connection
      const profile = this.registry.byPid(target);
      if (profile) {
        app = this.registry.toDetectedApp(profile);
      } else {
        const detected = await this.detector.detectByPid(target);
        if (!detected) throw new Error(`No detectable app at PID ${target}`);
        this.registry.register(detected);
        app = detected;
      }
    } else {
      // Name-based connection
      const profiles = await this.find(target);
      if (profiles.length === 0) throw new Error(`No app found matching "${target}"`);

      // For multi-process apps (Electron, etc.), prefer the process with a window title.
      // This avoids connecting to broker/crashpad/GPU subprocesses that have no UI.
      let best = profiles[0];
      if (profiles.length > 1) {
        const withWindow = profiles.filter(p => p.windowTitle && p.windowTitle.length > 0);
        if (withWindow.length > 0) {
          best = withWindow[0];
        }
      }
      app = this.registry.toDetectedApp(best);
    }

    // Ensure we have a valid PID
    if (!app.pid) throw new Error(`App "${app.name}" has no known PID. Run scan() first.`);

    const conn = await withRetry(
      () => this.router.connect(app),
      { maxRetries: 1, label: `connect-${app.name}` },
    );

    // Track in connection manager if persistent
    if (this.connectionMgr) {
      this.connectionMgr.track(app.pid, app, conn);
    }

    // Update registry with connection method
    this.registry.update(this.extractExe(app), {
      preferredMethod: (conn as { method?: string }).method as any,
    });

    // Get element count
    const elements = await conn.enumerate();
    const count = this.countElements(elements);

    return {
      pid: app.pid,
      name: app.name,
      framework: app.framework,
      method: (conn as { method?: string }).method || 'uab-hook',
      elementCount: count,
    };
  }

  /** Disconnect from an app. */
  async disconnect(pid: number): Promise<void> {
    if (this.connectionMgr) {
      this.connectionMgr.untrack(pid, 'manual');
    }
    this.cache.remove(pid);
    await this.router.disconnect(pid);
  }

  /** Disconnect from all apps. */
  async disconnectAll(): Promise<void> {
    if (this.connectionMgr) {
      for (const entry of this.connectionMgr.getAll()) {
        this.cache.remove(entry.pid);
        this.connectionMgr.untrack(entry.pid, 'disconnect-all');
      }
    }
    await this.router.disconnectAll();
  }

  /** Check if connected to a PID. */
  isConnected(pid: number): boolean {
    const route = this.router.getRoute(pid);
    return !!route && route.connection.connected;
  }

  // ─── Interaction ────────────────────────────────────────────────

  /** Get the UI element tree for a connected app. */
  async enumerate(pid: number, maxDepth = 3): Promise<UIElement[]> {
    this.ensureConnected(pid);

    const cached = this.cache.getTree(pid);
    if (cached) return cached;

    const route = this.router.getRoute(pid)!;
    const tree = await withRetry(
      () => route.connection.enumerate(),
      { maxRetries: 1, label: `enumerate-${pid}` },
    );

    this.cache.setTree(pid, tree);
    return tree;
  }

  /** Search for UI elements matching a selector. */
  async query(pid: number, selector: ElementSelector): Promise<UIElement[]> {
    this.ensureConnected(pid);

    const cached = this.cache.getQuery(pid, selector);
    if (cached) return cached;

    const route = this.router.getRoute(pid)!;
    const results = await withRetry(
      () => route.connection.query(selector),
      { maxRetries: 1, label: `query-${pid}` },
    );

    this.cache.setQuery(pid, selector, results);
    return results;
  }

  /** Perform an action on a UI element (with permission check + cache invalidation). */
  async act(pid: number, elementId: string, action: ActionType, params?: ActionParams): Promise<ActionResult> {
    this.ensureConnected(pid);

    const route = this.router.getRoute(pid)!;

    // Permission check
    const check = this.permissions.check(pid, action, route.app);
    this.permissions.record(pid, action, elementId, route.app, check.allowed, check.reason);
    if (!check.allowed) {
      return { success: false, error: check.reason };
    }

    const result = await withRetry(
      () => route.connection.act(elementId, action, params),
      { maxRetries: 1, label: `act-${pid}-${action}` },
    );

    this.cache.invalidateIfNeeded(pid, action);
    return result;
  }

  /** Get current app state. */
  async state(pid: number): Promise<AppState> {
    this.ensureConnected(pid);

    const cached = this.cache.getState(pid);
    if (cached) return cached as AppState;

    const route = this.router.getRoute(pid)!;
    const appState = await withRetry(
      () => route.connection.state(),
      { maxRetries: 1, label: `state-${pid}` },
    );

    this.cache.setState(pid, appState);
    return appState;
  }

  // ─── Keyboard & Window ──────────────────────────────────────────

  /** Send a single keypress. */
  async keypress(pid: number, key: string): Promise<ActionResult> {
    this.ensureConnected(pid);
    const route = this.router.getRoute(pid)!;
    const result = await route.connection.act('', 'keypress', { key });
    this.cache.invalidateIfNeeded(pid, 'keypress');
    return result;
  }

  /** Send a hotkey combination (e.g., "ctrl+s" or ['ctrl', 's']). */
  async hotkey(pid: number, keys: string | string[]): Promise<ActionResult> {
    this.ensureConnected(pid);
    const route = this.router.getRoute(pid)!;
    const keyArray = typeof keys === 'string' ? keys.split('+').map(k => k.trim()) : keys;
    const result = await route.connection.act('', 'hotkey', { keys: keyArray });
    this.cache.invalidateIfNeeded(pid, 'hotkey');
    return result;
  }

  /** Window management (minimize, maximize, restore, close, move, resize). */
  async window(pid: number, action: string, params?: { x?: number; y?: number; width?: number; height?: number }): Promise<ActionResult> {
    this.ensureConnected(pid);

    const actionMap: Record<string, ActionType> = {
      min: 'minimize', max: 'maximize', restore: 'restore', close: 'close',
      move: 'move', resize: 'resize',
      minimize: 'minimize', maximize: 'maximize',
    };

    const mapped = actionMap[action.toLowerCase()] || action as ActionType;
    return this.act(pid, '', mapped, params);
  }

  /** Capture a screenshot of the app window. Returns path + base64 data. */
  async screenshot(pid: number, outputPath?: string): Promise<ActionResult> {
    this.ensureConnected(pid);
    const route = this.router.getRoute(pid)!;
    const path = outputPath || `data/screenshots/uab-${pid}-${Date.now()}.png`;

    // Ensure directory exists
    const { mkdirSync, readFileSync, existsSync } = await import('fs');
    const { dirname } = await import('path');
    mkdirSync(dirname(path), { recursive: true });

    const result = await route.connection.act('', 'screenshot', { outputPath: path });

    // Always include base64 in the response so remote clients (Co-work) can read it
    if (result.success && !result.base64 && !result.data) {
      const filePath = (result as any).path || path;
      if (existsSync(filePath)) {
        (result as any).data = readFileSync(filePath).toString('base64');
      }
    }

    return result;
  }

  // ─── Diagnostics ────────────────────────────────────────────────

  /** Get cache hit statistics. */
  cacheStats() {
    return {
      ...this.cache.getStats(),
      hitRate: this.cache.getHitRate(),
    };
  }

  /** Get recent audit log of actions performed. */
  auditLog(limit = 50) {
    return this.permissions.getAuditLog(limit);
  }

  /** Get health summary (persistent mode only). */
  healthSummary() {
    if (!this.connectionMgr) return [];
    return this.connectionMgr.getHealthSummary();
  }

  // ─── Helpers ────────────────────────────────────────────────────

  private ensureStarted(): void {
    if (!this.started) throw new Error('Connector not started. Call start() first.');
  }

  private ensureConnected(pid: number): void {
    this.ensureStarted();
    const route = this.router.getRoute(pid);
    if (!route) throw new Error(`Not connected to PID ${pid}. Call connect() first.`);
  }

  private extractExe(app: DetectedApp): string {
    const parts = app.path.replace(/\\/g, '/').split('/');
    return (parts[parts.length - 1] || app.name).toLowerCase();
  }

  /** Count elements recursively. */
  countElements(elements: UIElement[]): number {
    let count = elements.length;
    for (const el of elements) count += this.countElements(el.children);
    return count;
  }

  /** Flatten UI tree for display. */
  flattenTree(elements: UIElement[], maxDepth = 3, depth = 0): Array<{ depth: number; id: string; type: string; label: string; actions: string[]; childCount: number }> {
    const flat: Array<{ depth: number; id: string; type: string; label: string; actions: string[]; childCount: number }> = [];
    if (depth > maxDepth) return flat;
    for (const el of elements) {
      flat.push({
        depth,
        id: el.id,
        type: el.type,
        label: el.label,
        actions: el.actions as string[],
        childCount: el.children.length,
      });
      flat.push(...this.flattenTree(el.children, maxDepth, depth + 1));
    }
    return flat;
  }
}
