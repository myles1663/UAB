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
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
// ─── Registry ───────────────────────────────────────────────────
export class AppRegistry {
    apps = new Map();
    pidIndex = new Map();
    profilePath;
    autoSave;
    dirty = false;
    constructor(options) {
        const dir = options?.profileDir || 'data/uab-profiles';
        this.profilePath = join(dir, 'registry.json');
        this.autoSave = options?.autoSave ?? true;
    }
    // ─── Persistence ──────────────────────────────────────────────
    /** Load profiles from JSON file on disk. Safe to call if file doesn't exist. */
    load() {
        if (!existsSync(this.profilePath))
            return;
        try {
            const raw = readFileSync(this.profilePath, 'utf-8');
            const snapshot = JSON.parse(raw);
            if (snapshot.version !== 1)
                return; // Only support v1
            this.apps.clear();
            this.pidIndex.clear();
            for (const [key, profile] of Object.entries(snapshot.apps)) {
                this.apps.set(key, profile);
                if (profile.pid) {
                    this.pidIndex.set(profile.pid, key);
                }
            }
            this.dirty = false;
        }
        catch {
            // Corrupted or unreadable — start fresh
        }
    }
    /** Persist current registry to JSON file. */
    save() {
        const snapshot = {
            version: 1,
            lastScan: Date.now(),
            appCount: this.apps.size,
            apps: Object.fromEntries(this.apps),
        };
        mkdirSync(dirname(this.profilePath), { recursive: true });
        writeFileSync(this.profilePath, JSON.stringify(snapshot, null, 2), 'utf-8');
        this.dirty = false;
    }
    maybeSave() {
        if (this.autoSave && this.dirty) {
            this.save();
        }
    }
    // ─── Registration ─────────────────────────────────────────────
    /** Register a detected app into the registry. Returns the profile.
     *  For multi-process apps (same exe name), keeps the entry with a window title. */
    register(app) {
        const key = this.keyFor(app);
        const existing = this.apps.get(key);
        // Don't overwrite a windowed process with a windowless one (Electron broker/GPU fix)
        if (existing && existing.windowTitle && existing.windowTitle.length > 0
            && (!app.windowTitle || app.windowTitle.length === 0)) {
            // Still index this PID so byPid lookups work
            this.pidIndex.set(app.pid, key);
            return existing;
        }
        const profile = {
            executable: key,
            name: app.name,
            pid: app.pid,
            framework: app.framework,
            confidence: app.confidence,
            preferredMethod: existing?.preferredMethod,
            connectionInfo: app.connectionInfo,
            path: app.path,
            windowTitle: app.windowTitle,
            lastSeen: Date.now(),
            tags: existing?.tags,
        };
        this.apps.set(key, profile);
        this.pidIndex.set(app.pid, key);
        this.dirty = true;
        this.maybeSave();
        return profile;
    }
    /** Register multiple detected apps in bulk. Single save at the end. */
    registerAll(apps) {
        const saved = this.autoSave;
        this.autoSave = false; // Defer save
        const profiles = apps.map(app => this.register(app));
        this.autoSave = saved;
        if (this.dirty)
            this.save();
        return profiles;
    }
    /** Update specific fields of a profile. */
    update(executable, patch) {
        const key = executable.toLowerCase();
        const existing = this.apps.get(key);
        if (!existing)
            return false;
        // Update PID index if PID changed
        if (patch.pid !== undefined && existing.pid !== patch.pid) {
            if (existing.pid)
                this.pidIndex.delete(existing.pid);
            if (patch.pid)
                this.pidIndex.set(patch.pid, key);
        }
        Object.assign(existing, patch, { executable: key }); // Don't allow key mutation
        this.dirty = true;
        this.maybeSave();
        return true;
    }
    /** Remove an app profile. */
    remove(executable) {
        const key = executable.toLowerCase();
        const existing = this.apps.get(key);
        if (!existing)
            return false;
        if (existing.pid)
            this.pidIndex.delete(existing.pid);
        this.apps.delete(key);
        this.dirty = true;
        this.maybeSave();
        return true;
    }
    // ─── Lookup ───────────────────────────────────────────────────
    /** Find profile by PID. O(1). */
    byPid(pid) {
        const key = this.pidIndex.get(pid);
        return key ? this.apps.get(key) : undefined;
    }
    /** Find profiles by name (case-insensitive substring match).
     *  For multi-process apps (Electron), prefers processes with a window title. */
    byName(name) {
        const lower = name.toLowerCase();
        const results = [];
        for (const profile of this.apps.values()) {
            if (profile.name.toLowerCase().includes(lower) ||
                profile.executable.includes(lower)) {
                results.push(profile);
            }
        }
        // If multiple matches, prefer those with a window title
        if (results.length > 1) {
            const withWindow = results.filter(r => r.windowTitle && r.windowTitle.length > 0);
            if (withWindow.length > 0)
                return withWindow;
        }
        return results;
    }
    /** Find profiles by framework type. */
    byFramework(framework) {
        const results = [];
        for (const profile of this.apps.values()) {
            if (profile.framework === framework)
                results.push(profile);
        }
        return results;
    }
    /** Find profile by exact executable key. */
    byExecutable(executable) {
        return this.apps.get(executable.toLowerCase());
    }
    /** Get all profiles. */
    all() {
        return Array.from(this.apps.values());
    }
    /** Number of registered apps. */
    count() {
        return this.apps.size;
    }
    /** Check if an app is in the registry. */
    has(executable) {
        return this.apps.has(executable.toLowerCase());
    }
    /** Clear all profiles. */
    clear() {
        this.apps.clear();
        this.pidIndex.clear();
        this.dirty = true;
        this.maybeSave();
    }
    // ─── Helpers ──────────────────────────────────────────────────
    /** Generate a stable key from a detected app (lowercase executable name). */
    keyFor(app) {
        // Extract executable name from path, fallback to app name
        const pathParts = app.path.replace(/\\/g, '/').split('/');
        const exe = pathParts[pathParts.length - 1] || app.name;
        return exe.toLowerCase();
    }
    /** Convert a registry profile back to DetectedApp format (for existing APIs). */
    toDetectedApp(profile) {
        return {
            pid: profile.pid || 0,
            name: profile.name,
            path: profile.path || profile.executable,
            framework: profile.framework,
            confidence: profile.confidence,
            connectionInfo: profile.connectionInfo,
            windowTitle: profile.windowTitle,
        };
    }
}
//# sourceMappingURL=registry.js.map