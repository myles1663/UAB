/**
 * UAB Service — Singleton service managing the Universal App Bridge lifecycle.
 *
 * Framework-agnostic: import this module from ClaudeClaw, Lancelot,
 * or any other AI agent runtime to get desktop app control.
 *
 * Phase 4 enhancements:
 *   - Connection Manager with health monitoring & auto-reconnect
 *   - Smart Element Cache with TTL & invalidation
 *   - Permission/Safety model for destructive actions
 *   - Retry with exponential backoff on transient errors
 *   - Action Chain executor for multi-step workflows
 *
 * Usage:
 *   import { uab } from './uab/service.js';
 *   await uab.start();                          // Initialize UAB
 *   const apps = await uab.detect();            // Scan for apps
 *   await uab.connect(apps[0]);                 // Connect to an app
 *   const buttons = await uab.query(pid, { type: 'button' });
 *   await uab.act(pid, buttons[0].id, 'click');
 *   await uab.stop();                           // Cleanup
 */
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
import { ConnectionManager } from './connection-manager.js';
import { ElementCache } from './cache.js';
import { PermissionManager } from './permissions.js';
import { ChainExecutor } from './chains.js';
import { withRetry } from './retry.js';
import { createLogger } from './logger.js';
const log = createLogger('uab');
export class UABService {
    detector;
    pluginManager;
    router;
    _running = false;
    // Phase 4: Production hardening modules
    connectionMgr;
    cache;
    permissions;
    chainExecutor;
    // Phase 5: Chrome Extension bridge
    extensionServer;
    constructor() {
        this.detector = new FrameworkDetector();
        this.pluginManager = new PluginManager();
        this.router = new ControlRouter(this.pluginManager);
        // Phase 4 modules
        this.connectionMgr = new ConnectionManager(this.router);
        this.cache = new ElementCache();
        this.permissions = new PermissionManager();
        this.chainExecutor = new ChainExecutor(this);
        // Phase 5: Chrome Extension WebSocket bridge
        this.extensionServer = new ExtensionWSServer();
    }
    get running() { return this._running; }
    /**
     * Initialize UAB — register all available plugins & start monitoring.
     */
    async start() {
        if (this._running)
            return;
        // Ensure screenshots directory exists
        const fs = await import('fs');
        fs.mkdirSync('data/screenshots', { recursive: true });
        // Start Chrome Extension WebSocket bridge (non-blocking)
        try {
            await this.extensionServer.start();
            log.info('Extension WS bridge ready on port 8787');
        }
        catch (err) {
            log.warn('Extension WS bridge failed to start (port in use?)', {
                error: err.message,
            });
        }
        // Register framework plugins (priority order: specific -> generic)
        // ChromeExtPlugin is highest priority for browsers — no relaunch needed!
        this.pluginManager.register(new ChromeExtPlugin(this.extensionServer)); // Extension bridge (no relaunch)
        this.pluginManager.register(new BrowserPlugin()); // CDP -- fallback (needs relaunch)
        this.pluginManager.register(new ElectronPlugin()); // CDP -- best for Electron
        this.pluginManager.register(new OfficePlugin()); // Office (Word/Excel/PPT) + document content
        this.pluginManager.register(new QtPlugin()); // Qt via UIA
        this.pluginManager.register(new GtkPlugin()); // GTK via UIA
        this.pluginManager.register(new JavaPlugin()); // Java via JAB->UIA
        this.pluginManager.register(new FlutterPlugin()); // Flutter via UIA
        this.pluginManager.register(new WinUIAPlugin()); // Universal Windows fallback
        // Start connection health monitoring
        this.connectionMgr.startMonitoring();
        this._running = true;
        log.info('UAB service started', {
            frameworks: this.pluginManager.getRegisteredFrameworks(),
            extensionBridge: this.extensionServer.connected,
        });
    }
    /**
     * Stop UAB — disconnect all apps, stop monitoring, clean up.
     */
    async stop() {
        if (!this._running)
            return;
        await this.connectionMgr.shutdown();
        await this.router.disconnectAll();
        await this.extensionServer.stop();
        this.cache.clear();
        this.permissions.clear();
        this._running = false;
        log.info('UAB service stopped');
    }
    // ─── Discovery ──────────────────────────────────────────────────
    /** Scan all running processes for controllable apps */
    async detect() {
        return this.detector.detectAll();
    }
    /** Quick-scan for Electron apps only */
    async detectElectron() {
        return this.detector.detectElectron();
    }
    /** Deep-inspect a specific PID */
    async detectByPid(pid) {
        return this.detector.detectByPid(pid);
    }
    /** Find apps by name (fuzzy) */
    async findByName(name) {
        return this.detector.findByName(name);
    }
    // ─── Connection ─────────────────────────────────────────────────
    /** Connect to an app — auto-selects the best control method */
    async connect(app) {
        const conn = await withRetry(() => this.router.connect(app), { maxRetries: 1, label: `connect-${app.name}` });
        this.connectionMgr.track(app.pid, app, conn);
        log.info('Connected to app', {
            name: app.name,
            pid: app.pid,
            framework: app.framework,
            method: conn.method,
        });
        return { method: conn.method, pid: app.pid };
    }
    /** Disconnect from an app */
    async disconnect(pid) {
        this.connectionMgr.untrack(pid, 'manual');
        this.cache.remove(pid);
        await this.router.disconnect(pid);
        log.info('Disconnected from app', { pid });
    }
    /** Disconnect all apps */
    async disconnectAll() {
        for (const entry of this.connectionMgr.getAll()) {
            this.cache.remove(entry.pid);
            this.connectionMgr.untrack(entry.pid, 'disconnect-all');
        }
        await this.router.disconnectAll();
    }
    /** Check if connected to a PID */
    isConnected(pid) {
        const route = this.router.getRoute(pid);
        return !!route && route.connection.connected;
    }
    /** Get all active connections */
    getConnections() {
        return this.pluginManager.getActiveConnections()
            .filter(c => c.connected)
            .map(c => ({
            pid: c.pid,
            name: c.app.name,
            framework: c.app.framework,
            method: this.router.getRoute(c.pid)?.method || 'unknown',
        }));
    }
    // ─── Unified API (with cache + permissions + retry) ─────────────
    /** Get the full UI element tree for a connected app */
    async enumerate(pid) {
        // Check cache first
        const cached = this.cache.getTree(pid);
        if (cached)
            return cached;
        const route = this.router.getRoute(pid);
        if (!route)
            throw new Error(`Not connected to PID ${pid}`);
        const tree = await withRetry(() => route.connection.enumerate(), { maxRetries: 1, label: `enumerate-${pid}` });
        this.cache.setTree(pid, tree);
        return tree;
    }
    /** Search for UI elements matching a selector */
    async query(pid, selector) {
        // Check cache first
        const cached = this.cache.getQuery(pid, selector);
        if (cached)
            return cached;
        const route = this.router.getRoute(pid);
        if (!route)
            throw new Error(`Not connected to PID ${pid}`);
        const results = await withRetry(() => route.connection.query(selector), { maxRetries: 1, label: `query-${pid}` });
        this.cache.setQuery(pid, selector, results);
        return results;
    }
    /** Perform an action on a UI element (with permission check + cache invalidation) */
    async act(pid, elementId, action, params) {
        const route = this.router.getRoute(pid);
        if (!route)
            throw new Error(`Not connected to PID ${pid}`);
        // Permission check
        const check = this.permissions.check(pid, action, route.app);
        this.permissions.record(pid, action, elementId, route.app, check.allowed, check.reason);
        if (!check.allowed) {
            return { success: false, error: check.reason };
        }
        const result = await withRetry(() => route.connection.act(elementId, action, params), { maxRetries: 1, label: `act-${pid}-${action}` });
        // Invalidate cache after mutating actions
        this.cache.invalidateIfNeeded(pid, action);
        log.debug('Action performed', { pid, elementId, action, success: result.success });
        return result;
    }
    /** Get current app state */
    async state(pid) {
        // Check cache first
        const cached = this.cache.getState(pid);
        if (cached)
            return cached;
        const route = this.router.getRoute(pid);
        if (!route)
            throw new Error(`Not connected to PID ${pid}`);
        const appState = await withRetry(() => route.connection.state(), { maxRetries: 1, label: `state-${pid}` });
        this.cache.setState(pid, appState);
        return appState;
    }
    // ─── Phase 3: Keyboard Input ────────────────────────────────────
    /** Send a single keypress to a connected app */
    async keypress(pid, key) {
        const route = this.router.getRoute(pid);
        if (!route)
            throw new Error(`Not connected to PID ${pid}`);
        const result = await route.connection.act('', 'keypress', { key });
        this.cache.invalidateIfNeeded(pid, 'keypress');
        return result;
    }
    /** Send a hotkey combination to a connected app (e.g., ['ctrl', 's']) */
    async hotkey(pid, keys) {
        const route = this.router.getRoute(pid);
        if (!route)
            throw new Error(`Not connected to PID ${pid}`);
        const result = await route.connection.act('', 'hotkey', { keys });
        this.cache.invalidateIfNeeded(pid, 'hotkey');
        return result;
    }
    // ─── Phase 3: Window Management ──────────────────────────────────
    /** Minimize a window */
    async minimize(pid) {
        const route = this.router.getRoute(pid);
        if (!route)
            throw new Error(`Not connected to PID ${pid}`);
        return route.connection.act('', 'minimize');
    }
    /** Maximize a window */
    async maximize(pid) {
        const route = this.router.getRoute(pid);
        if (!route)
            throw new Error(`Not connected to PID ${pid}`);
        return route.connection.act('', 'maximize');
    }
    /** Restore a window from min/max */
    async restore(pid) {
        const route = this.router.getRoute(pid);
        if (!route)
            throw new Error(`Not connected to PID ${pid}`);
        return route.connection.act('', 'restore');
    }
    /** Close a window gracefully */
    async closeWindow(pid) {
        return this.act(pid, '', 'close'); // Goes through permission check
    }
    /** Move a window to (x, y) */
    async moveWindow(pid, x, y) {
        const route = this.router.getRoute(pid);
        if (!route)
            throw new Error(`Not connected to PID ${pid}`);
        return route.connection.act('', 'move', { x, y });
    }
    /** Resize a window to (width, height) */
    async resizeWindow(pid, width, height) {
        const route = this.router.getRoute(pid);
        if (!route)
            throw new Error(`Not connected to PID ${pid}`);
        return route.connection.act('', 'resize', { width, height });
    }
    // ─── Phase 3: Screenshot ──────────────────────────────────────
    /** Capture a screenshot of a connected app's window */
    async screenshot(pid, outputPath) {
        const route = this.router.getRoute(pid);
        if (!route)
            throw new Error(`Not connected to PID ${pid}`);
        return route.connection.act('', 'screenshot', { outputPath });
    }
    // ─── Phase 4: Action Chains ───────────────────────────────────
    /** Execute a multi-step action chain */
    async executeChain(chain) {
        return this.chainExecutor.execute(chain);
    }
    // ─── Phase 4: Health & Diagnostics ─────────────────────────────
    /** Get connection health summary */
    getHealthSummary() {
        return this.connectionMgr.getHealthSummary();
    }
    /** Get cache statistics */
    getCacheStats() {
        return {
            ...this.cache.getStats(),
            hitRate: this.cache.getHitRate(),
        };
    }
    /** Get recent audit log */
    getAuditLog(limit = 50) {
        return this.permissions.getAuditLog(limit);
    }
    /** Trigger a manual health check on all connections */
    async checkHealth() {
        await this.connectionMgr.runHealthChecks();
    }
    // ─── Convenience ────────────────────────────────────────────────
    /** Connect by name — finds the app and connects in one step */
    async connectByName(name) {
        const matches = await this.findByName(name);
        if (matches.length === 0)
            throw new Error(`No app found matching "${name}"`);
        if (matches.length > 1) {
            const list = matches.map(m => `  PID ${m.pid}: ${m.name}`).join('\n');
            throw new Error(`Multiple apps match "${name}":\n${list}\nSpecify a PID instead.`);
        }
        const app = matches[0];
        const result = await this.connect(app);
        return { ...result, app };
    }
    /** Count all UI elements recursively */
    countElements(elements) {
        let count = elements.length;
        for (const el of elements)
            count += this.countElements(el.children);
        return count;
    }
    /** Flatten UI tree to a simple list (for display) */
    flattenTree(elements, maxDepth = 3, depth = 0) {
        const flat = [];
        if (depth > maxDepth)
            return flat;
        for (const el of elements) {
            flat.push({ depth, element: el });
            flat.push(...this.flattenTree(el.children, maxDepth, depth + 1));
        }
        return flat;
    }
}
/** Singleton UAB service instance */
export const uab = new UABService();
//# sourceMappingURL=service.js.map