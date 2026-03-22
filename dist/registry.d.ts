/**
 * App Registry — In-memory knowledge base with JSON profile persistence.
 *
 * The registry is the connector's "brain" — it remembers apps across sessions
 * without needing a database. Data lives in a Map for O(1) lookups,
 * with optional JSON file persistence for cross-session survival.
 *
 * Design principles:
 *   - Zero dependencies (no SQLite, no agent frameworks)
 *   - Fast: all lookups are in-memory Map reads
 *   - Git-friendly: single JSON file with readable diffs
 *   - Scales to 1000+ apps: Map is O(1), JSON file is just a snapshot
 *   - Framework-independent: any agent can use this
 */
import type { FrameworkType, DetectedApp, ControlMethod } from './types.js';
export interface AppProfile {
    /** Stable key — lowercase executable name (e.g., "code.exe") */
    executable: string;
    /** Human-readable app name (e.g., "Visual Studio Code") */
    name: string;
    /** Last known PID (may be stale after restart) */
    pid?: number;
    /** Detected UI framework */
    framework: FrameworkType;
    /** Detection confidence 0.0–1.0 */
    confidence: number;
    /** Best control method found for this app */
    preferredMethod?: ControlMethod;
    /** Framework-specific connection params */
    connectionInfo?: Record<string, unknown>;
    /** Full executable path */
    path?: string;
    /** Window title at last detection */
    windowTitle?: string;
    /** Unix timestamp of last successful detection */
    lastSeen: number;
    /** User-defined tags for categorization */
    tags?: string[];
}
export interface RegistrySnapshot {
    version: number;
    lastScan: number;
    appCount: number;
    apps: Record<string, AppProfile>;
}
export interface RegistryOptions {
    /** Directory for profile persistence. Default: data/uab-profiles */
    profileDir?: string;
    /** Auto-save after mutations. Default: true */
    autoSave?: boolean;
}
export declare class AppRegistry {
    private apps;
    private pidIndex;
    private profilePath;
    private autoSave;
    private dirty;
    constructor(options?: RegistryOptions);
    /** Load profiles from JSON file on disk. Safe to call if file doesn't exist. */
    load(): void;
    /** Persist current registry to JSON file. */
    save(): void;
    private maybeSave;
    /** Register a detected app into the registry. Returns the profile.
     *  For multi-process apps (same exe name), keeps the entry with a window title. */
    register(app: DetectedApp): AppProfile;
    /** Register multiple detected apps in bulk. Single save at the end. */
    registerAll(apps: DetectedApp[]): AppProfile[];
    /** Update specific fields of a profile. */
    update(executable: string, patch: Partial<AppProfile>): boolean;
    /** Remove an app profile. */
    remove(executable: string): boolean;
    /** Find profile by PID. O(1). */
    byPid(pid: number): AppProfile | undefined;
    /** Find profiles by name (case-insensitive substring match).
     *  For multi-process apps (Electron), prefers processes with a window title. */
    byName(name: string): AppProfile[];
    /** Find profiles by framework type. */
    byFramework(framework: FrameworkType): AppProfile[];
    /** Find profile by exact executable key. */
    byExecutable(executable: string): AppProfile | undefined;
    /** Get all profiles. */
    all(): AppProfile[];
    /** Number of registered apps. */
    count(): number;
    /** Check if an app is in the registry. */
    has(executable: string): boolean;
    /** Clear all profiles. */
    clear(): void;
    /** Generate a stable key from a detected app (lowercase executable name). */
    private keyFor;
    /** Convert a registry profile back to DetectedApp format (for existing APIs). */
    toDetectedApp(profile: AppProfile): DetectedApp;
}
//# sourceMappingURL=registry.d.ts.map