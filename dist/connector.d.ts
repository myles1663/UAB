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
import { AppRegistry } from './registry.js';
import type { AppProfile } from './registry.js';
import type { UIElement, ElementSelector, ActionType, ActionParams, ActionResult, AppState } from './types.js';
export interface ConnectorOptions {
    /** Directory for JSON profile persistence. Default: "data/uab-profiles" */
    profileDir?: string;
    /** Enable persistent connections with health monitoring. Default: false (stateless) */
    persistent?: boolean;
    /** Enable Chrome extension WebSocket bridge. Default: false */
    extensionBridge?: boolean;
    /** Load existing profiles on start. Default: true */
    loadProfiles?: boolean;
    /** Max actions per minute per PID (rate limiting). Default: 100 */
    rateLimit?: number;
}
export interface ConnectionInfo {
    pid: number;
    name: string;
    framework: string;
    method: string;
    elementCount: number;
}
export declare class UABConnector {
    readonly registry: AppRegistry;
    private detector;
    private pluginManager;
    private router;
    private cache;
    private permissions;
    private connectionMgr;
    private extensionServer;
    private opts;
    private started;
    constructor(options?: ConnectorOptions);
    /** Initialize the connector. Call before any other method. */
    start(): Promise<void>;
    /** Stop the connector and release all resources. */
    stop(): Promise<void>;
    /** Is the connector running? */
    get running(): boolean;
    /**
     * Scan for all controllable apps and register them.
     * Returns fresh profiles with live PIDs.
     */
    scan(electronOnly?: boolean): Promise<AppProfile[]>;
    /**
     * List known apps from registry (no scan — instant).
     * Call scan() first to populate, or load() to restore saved profiles.
     */
    apps(): AppProfile[];
    /**
     * Search registry by name (fuzzy, case-insensitive).
     * If no results in registry, falls back to live detection.
     */
    find(query: string): Promise<AppProfile[]>;
    /** Inspect a specific PID. */
    inspectPid(pid: number): Promise<AppProfile | null>;
    /** Connect to an app by PID. Auto-detects if not in registry. */
    connect(pid: number): Promise<ConnectionInfo>;
    /** Connect to an app by name. Searches registry, then live-detects. */
    connect(name: string): Promise<ConnectionInfo>;
    /** Disconnect from an app. */
    disconnect(pid: number): Promise<void>;
    /** Disconnect from all apps. */
    disconnectAll(): Promise<void>;
    /** Check if connected to a PID. */
    isConnected(pid: number): boolean;
    /** Get the UI element tree for a connected app. */
    enumerate(pid: number, maxDepth?: number): Promise<UIElement[]>;
    /** Search for UI elements matching a selector. */
    query(pid: number, selector: ElementSelector): Promise<UIElement[]>;
    /** Perform an action on a UI element (with permission check + cache invalidation). */
    act(pid: number, elementId: string, action: ActionType, params?: ActionParams): Promise<ActionResult>;
    /** Get current app state. */
    state(pid: number): Promise<AppState>;
    /** Send a single keypress. */
    keypress(pid: number, key: string): Promise<ActionResult>;
    /** Send a hotkey combination (e.g., "ctrl+s" or ['ctrl', 's']). */
    hotkey(pid: number, keys: string | string[]): Promise<ActionResult>;
    /** Window management (minimize, maximize, restore, close, move, resize). */
    window(pid: number, action: string, params?: {
        x?: number;
        y?: number;
        width?: number;
        height?: number;
    }): Promise<ActionResult>;
    /** Capture a screenshot of the app window. */
    screenshot(pid: number, outputPath?: string): Promise<ActionResult>;
    /** Get cache hit statistics. */
    cacheStats(): {
        hitRate: number;
        treeCacheSize: number;
        queryCacheSize: number;
        stateCacheSize: number;
        totalHits: number;
        totalMisses: number;
        invalidations: number;
    };
    /** Get recent audit log of actions performed. */
    auditLog(limit?: number): import("./permissions.js").AuditEntry[];
    /** Get health summary (persistent mode only). */
    healthSummary(): {
        pid: number;
        name: string;
        healthy: boolean;
        uptimeMs: number;
        failures: number;
        method: string;
    }[];
    private ensureStarted;
    private ensureConnected;
    private extractExe;
    /** Count elements recursively. */
    countElements(elements: UIElement[]): number;
    /** Flatten UI tree for display. */
    flattenTree(elements: UIElement[], maxDepth?: number, depth?: number): Array<{
        depth: number;
        id: string;
        type: string;
        label: string;
        actions: string[];
        childCount: number;
    }>;
}
