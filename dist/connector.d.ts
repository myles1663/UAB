/**
 * UABConnector — Framework-independent desktop app control.
 *
 * This is the public API that ANY agent framework can use:
 *   - Claude Code (via Bash → CLI)
 *   - Codex CLI (via Bash → CLI)
 *   - Custom agents (import as library)
 *   - MD-only agents (via CLI JSON output)
 *   - Kai Telegram bot (via service mode)
 *
 * NOTE: Synced from UAB standalone repo. ClaudeClaw references renamed to Kai.
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
import type { UIElement, ElementSelector, ActionType, ActionParams, ActionResult, AppState, FocusedElementInfo, PathSelector, AtomicChainDef, AtomicChainResult, SmartResolveResult, StateChangeEvent, FrameworkHookDescriptor } from './types.js';
import type { FrameworkSignature } from './detector.js';
import { CompositeEngine } from './composite.js';
import type { CompositeResult, CompositeOptions } from './composite.js';
import type { SpatialElement } from './spatial.js';
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
     * List the framework hooks that are currently registered in this connector.
     * This is the source of truth for what the standalone runtime can actually use.
     */
    hookInventory(): FrameworkHookDescriptor[];
    signatureInventory(): FrameworkSignature[];
    concertoInventory(): import("./types.js").ConcertoMethodDescriptor[];
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
    /** P6 raw input injection — drag along a waypoint path. */
    drag(pid: number, path: Array<{
        x: number;
        y: number;
    }>, stepDelay?: number, button?: 'left' | 'middle' | 'right'): Promise<ActionResult>;
    /** P6 raw input injection — scroll at absolute coordinates. */
    scroll(pid: number, x: number, y: number, amount: number): Promise<ActionResult>;
    /** Window management (minimize, maximize, restore, close, move, resize). */
    window(pid: number, action: string, params?: {
        x?: number;
        y?: number;
        width?: number;
        height?: number;
    }): Promise<ActionResult>;
    /** Capture a screenshot of the app window. Returns path + base64 data. */
    screenshot(pid: number, outputPath?: string): Promise<ActionResult>;
    planOperation(pid: number, action: ActionType | 'describe'): import("./types.js").OperationPlan;
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
    /** Get the composite engine for advanced spatial queries. */
    get composite(): CompositeEngine;
    private _composite;
    /**
     * Build a spatial map of the app — bounding rects organized into rows/columns.
     * This is FASTER than screenshots and gives AI structured positional data.
     */
    spatialMap(pid: number, options?: CompositeOptions): Promise<CompositeResult>;
    /**
     * Get a text-based map of the app layout for AI consumption.
     * Replaces screenshots in most use cases.
     */
    textMap(pid: number, format?: 'detailed' | 'compact' | 'json'): Promise<string>;
    /**
     * Find elements by natural language description using spatial map + text reading.
     * Faster than vision-based element finding.
     */
    findByDescription(pid: number, description: string): Promise<SpatialElement[]>;
    /**
     * Get the currently focused element in a window — <50ms via UIA FocusedElement.
     * No connection required; works with any visible window.
     */
    focused(pid: number): Promise<FocusedElementInfo>;
    /**
     * Find elements by tree path or parent context.
     * Solves the "5 elements named Close" problem.
     *
     * @example
     * // By tree path: Menu Bar → File → Save As...
     * await connector.findByPath(pid, { path: ["File", "Save As..."] })
     *
     * // By parent context: "Close" inside "Settings dialog"
     * await connector.findByPath(pid, { name: "Close", parent: "Settings" })
     */
    findByPath(pid: number, selector: PathSelector): Promise<Array<{
        name: string;
        type: string;
        automationId: string;
        bounds: {
            x: number;
            y: number;
            w: number;
            h: number;
        };
        patterns: string;
    }>>;
    /**
     * Watch for UIA state changes on a window. Polls efficiently at configurable interval.
     * Returns a snapshot of changes since last check.
     *
     * For real-time push notifications, use the HTTP server's SSE endpoint.
     */
    watchChanges(pid: number, durationMs?: number, pollMs?: number): Promise<StateChangeEvent[]>;
    /**
     * Execute a sequence of actions in a SINGLE PowerShell session.
     * No focus-stealing between steps. All actions fire atomically.
     *
     * @example
     * await connector.atomicChain({
     *   pid: 38184,
     *   steps: [
     *     { action: 'hotkey', keys: ['alt', 'm'] },
     *     { action: 'wait', ms: 300 },
     *     { action: 'keypress', key: 'Down' },
     *     { action: 'keypress', key: 'Enter' },
     *   ]
     * });
     */
    atomicChain(chain: AtomicChainDef): Promise<AtomicChainResult>;
    /** Map key names to PowerShell SendKeys format */
    private psKeyMap;
    /**
     * Find an element by name and invoke it using the BEST available method.
     * Tries in order:
     *   1. InvokePattern (standard UIA invoke)
     *   2. SetFocus → Enter key
     *   3. Find nearest invokable parent/sibling
     *   4. Calculate bounding rect center → click at coordinates
     *   5. ExpandCollapsePattern
     *   6. TogglePattern
     *
     * This is the "it just works" method — if the element is visible, we WILL activate it.
     */
    smartInvoke(pid: number, name: string, options?: {
        parent?: string;
        type?: string;
        occurrence?: 'first' | 'last' | number;
    }): Promise<SmartResolveResult>;
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
//# sourceMappingURL=connector.d.ts.map