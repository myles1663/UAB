/**
 * UAB Service — Singleton service managing the Universal App Bridge lifecycle.
 *
 * Framework-agnostic: import this module from Kai, Lancelot,
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
import { ExtensionWSServer } from './plugins/chrome-ext/ws-server.js';
import { PermissionManager } from './permissions.js';
import { type ChainDefinition, type ChainResult } from './chains.js';
import type { DetectedApp, UIElement, ElementSelector, ActionType, ActionParams, ActionResult, AppState } from './types.js';
export declare class UABService {
    private detector;
    private pluginManager;
    private router;
    private _running;
    private connectionMgr;
    private cache;
    readonly permissions: PermissionManager;
    private chainExecutor;
    readonly extensionServer: ExtensionWSServer;
    constructor();
    get running(): boolean;
    /**
     * Initialize UAB — register all available plugins & start monitoring.
     */
    start(): Promise<void>;
    /**
     * Stop UAB — disconnect all apps, stop monitoring, clean up.
     */
    stop(): Promise<void>;
    /** Scan all running processes for controllable apps */
    detect(): Promise<DetectedApp[]>;
    /** Quick-scan for Electron apps only */
    detectElectron(): Promise<DetectedApp[]>;
    /** Deep-inspect a specific PID */
    detectByPid(pid: number): Promise<DetectedApp | null>;
    /** Find apps by name (fuzzy) */
    findByName(name: string): Promise<DetectedApp[]>;
    /** Connect to an app — auto-selects the best control method */
    connect(app: DetectedApp): Promise<{
        method: string;
        pid: number;
    }>;
    /** Disconnect from an app */
    disconnect(pid: number): Promise<void>;
    /** Disconnect all apps */
    disconnectAll(): Promise<void>;
    /** Check if connected to a PID */
    isConnected(pid: number): boolean;
    /** Get all active connections */
    getConnections(): Array<{
        pid: number;
        name: string;
        framework: string;
        method: string;
    }>;
    /** Get the full UI element tree for a connected app */
    enumerate(pid: number): Promise<UIElement[]>;
    /** Search for UI elements matching a selector */
    query(pid: number, selector: ElementSelector): Promise<UIElement[]>;
    /** Perform an action on a UI element (with permission check + cache invalidation) */
    act(pid: number, elementId: string, action: ActionType, params?: ActionParams): Promise<ActionResult>;
    /** Get current app state */
    state(pid: number): Promise<AppState>;
    /** Send a single keypress to a connected app */
    keypress(pid: number, key: string): Promise<ActionResult>;
    /** Send a hotkey combination to a connected app (e.g., ['ctrl', 's']) */
    hotkey(pid: number, keys: string[]): Promise<ActionResult>;
    /** Minimize a window */
    minimize(pid: number): Promise<ActionResult>;
    /** Maximize a window */
    maximize(pid: number): Promise<ActionResult>;
    /** Restore a window from min/max */
    restore(pid: number): Promise<ActionResult>;
    /** Close a window gracefully */
    closeWindow(pid: number): Promise<ActionResult>;
    /** Move a window to (x, y) */
    moveWindow(pid: number, x: number, y: number): Promise<ActionResult>;
    /** Resize a window to (width, height) */
    resizeWindow(pid: number, width: number, height: number): Promise<ActionResult>;
    /** Capture a screenshot of a connected app's window */
    screenshot(pid: number, outputPath?: string): Promise<ActionResult>;
    /** Execute a multi-step action chain */
    executeChain(chain: ChainDefinition): Promise<ChainResult>;
    /** Get connection health summary */
    getHealthSummary(): Array<{
        pid: number;
        name: string;
        healthy: boolean;
        uptimeMs: number;
        failures: number;
        method: string;
    }>;
    /** Get cache statistics */
    getCacheStats(): {
        hitRate: number;
        treeCacheSize: number;
        queryCacheSize: number;
        stateCacheSize: number;
        totalHits: number;
        totalMisses: number;
        invalidations: number;
    };
    /** Get recent audit log */
    getAuditLog(limit?: number): import("./permissions.js").AuditEntry[];
    /** Trigger a manual health check on all connections */
    checkHealth(): Promise<void>;
    /** Connect by name — finds the app and connects in one step */
    connectByName(name: string): Promise<{
        method: string;
        pid: number;
        app: DetectedApp;
    }>;
    /** Count all UI elements recursively */
    countElements(elements: UIElement[]): number;
    /** Flatten UI tree to a simple list (for display) */
    flattenTree(elements: UIElement[], maxDepth?: number, depth?: number): Array<{
        depth: number;
        element: UIElement;
    }>;
}
/** Singleton UAB service instance */
export declare const uab: UABService;
//# sourceMappingURL=service.d.ts.map