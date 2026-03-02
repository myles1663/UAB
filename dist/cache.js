/**
 * UAB Smart Cache — Intelligent element tree caching with TTL & invalidation.
 *
 * Phase 4: Performance optimization.
 * - Per-PID element tree caching with configurable TTL
 * - Automatic invalidation on mutating actions (click, type, etc.)
 * - Query result caching with selector-based keys
 * - Cache statistics for debugging
 * - Lazy enumeration (only re-fetch when cache expired)
 */
import { createLogger } from './logger.js';
const log = createLogger('uab-cache');
/** Actions that likely change the UI tree — invalidate cache after these */
const MUTATING_ACTIONS = new Set([
    'click', 'doubleclick', 'rightclick',
    'type', 'clear', 'select',
    'check', 'uncheck', 'toggle',
    'expand', 'collapse', 'invoke',
    'keypress', 'hotkey',
    'close',
    // Browser navigation actions change DOM
    'navigate', 'goBack', 'goForward', 'reload',
    'switchTab', 'newTab', 'closeTab',
    // Browser storage/cookie mutations
    'setCookie', 'deleteCookie', 'clearCookies',
    'setLocalStorage', 'deleteLocalStorage', 'clearLocalStorage',
    'setSessionStorage', 'deleteSessionStorage', 'clearSessionStorage',
    'executeScript',
]);
/** Actions that don't change the tree — safe to keep cache */
const READ_ONLY_ACTIONS = new Set([
    'focus', 'hover', 'scroll', 'screenshot',
    'minimize', 'maximize', 'restore', 'move', 'resize',
    // Browser read-only actions
    'getCookies', 'getLocalStorage', 'getSessionStorage', 'getTabs',
]);
export class ElementCache {
    treeCache = new Map();
    queryCache = new Map();
    stateCache = new Map();
    options;
    totalHits = 0;
    totalMisses = 0;
    invalidations = 0;
    constructor(options) {
        this.options = {
            treeTtl: options?.treeTtl ?? 5000,
            queryTtl: options?.queryTtl ?? 3000,
            stateTtl: options?.stateTtl ?? 2000,
            maxQueriesPerPid: options?.maxQueriesPerPid ?? 50,
        };
    }
    // ─── Tree Cache ──────────────────────────────────────────────
    /** Get cached element tree for a PID */
    getTree(pid) {
        const entry = this.treeCache.get(pid);
        if (!entry) {
            this.totalMisses++;
            return null;
        }
        if (Date.now() - entry.createdAt > this.options.treeTtl) {
            this.treeCache.delete(pid);
            this.totalMisses++;
            return null;
        }
        entry.accessedAt = Date.now();
        entry.hitCount++;
        this.totalHits++;
        return entry.data;
    }
    /** Store element tree in cache */
    setTree(pid, tree) {
        const now = Date.now();
        this.treeCache.set(pid, {
            data: tree,
            createdAt: now,
            accessedAt: now,
            hitCount: 0,
        });
    }
    // ─── Query Cache ─────────────────────────────────────────────
    /** Get cached query result */
    getQuery(pid, selector) {
        const key = this.queryKey(pid, selector);
        const entry = this.queryCache.get(key);
        if (!entry) {
            this.totalMisses++;
            return null;
        }
        if (Date.now() - entry.createdAt > this.options.queryTtl) {
            this.queryCache.delete(key);
            this.totalMisses++;
            return null;
        }
        entry.accessedAt = Date.now();
        entry.hitCount++;
        this.totalHits++;
        return entry.data;
    }
    /** Store query result in cache */
    setQuery(pid, selector, results) {
        const key = this.queryKey(pid, selector);
        const now = Date.now();
        // Evict oldest queries if over limit
        const pidPrefix = `${pid}:`;
        let pidCount = 0;
        for (const k of this.queryCache.keys()) {
            if (k.startsWith(pidPrefix))
                pidCount++;
        }
        if (pidCount >= this.options.maxQueriesPerPid) {
            let oldest = null;
            for (const [k, v] of this.queryCache) {
                if (k.startsWith(pidPrefix) && (!oldest || v.accessedAt < oldest.time)) {
                    oldest = { key: k, time: v.accessedAt };
                }
            }
            if (oldest)
                this.queryCache.delete(oldest.key);
        }
        this.queryCache.set(key, {
            data: results,
            createdAt: now,
            accessedAt: now,
            hitCount: 0,
        });
    }
    // ─── State Cache ─────────────────────────────────────────────
    /** Get cached app state */
    getState(pid) {
        const entry = this.stateCache.get(pid);
        if (!entry) {
            this.totalMisses++;
            return null;
        }
        if (Date.now() - entry.createdAt > this.options.stateTtl) {
            this.stateCache.delete(pid);
            this.totalMisses++;
            return null;
        }
        entry.accessedAt = Date.now();
        entry.hitCount++;
        this.totalHits++;
        return entry.data;
    }
    /** Store app state in cache */
    setState(pid, state) {
        const now = Date.now();
        this.stateCache.set(pid, {
            data: state,
            createdAt: now,
            accessedAt: now,
            hitCount: 0,
        });
    }
    // ─── Invalidation ────────────────────────────────────────────
    /** Invalidate all caches for a PID (after mutating action) */
    invalidate(pid) {
        this.treeCache.delete(pid);
        this.stateCache.delete(pid);
        // Remove all query cache entries for this PID
        const pidPrefix = `${pid}:`;
        for (const key of this.queryCache.keys()) {
            if (key.startsWith(pidPrefix)) {
                this.queryCache.delete(key);
            }
        }
        this.invalidations++;
        log.debug('Cache invalidated', { pid });
    }
    /** Check if an action should invalidate the cache */
    shouldInvalidate(action) {
        return MUTATING_ACTIONS.has(action);
    }
    /** Invalidate if the action is mutating */
    invalidateIfNeeded(pid, action) {
        if (this.shouldInvalidate(action)) {
            this.invalidate(pid);
        }
    }
    /** Clear all caches */
    clear() {
        this.treeCache.clear();
        this.queryCache.clear();
        this.stateCache.clear();
        log.debug('All caches cleared');
    }
    /** Remove caches for a specific PID (on disconnect) */
    remove(pid) {
        this.invalidate(pid);
    }
    // ─── Stats ───────────────────────────────────────────────────
    /** Get cache statistics */
    getStats() {
        return {
            treeCacheSize: this.treeCache.size,
            queryCacheSize: this.queryCache.size,
            stateCacheSize: this.stateCache.size,
            totalHits: this.totalHits,
            totalMisses: this.totalMisses,
            invalidations: this.invalidations,
        };
    }
    /** Get hit rate as a percentage */
    getHitRate() {
        const total = this.totalHits + this.totalMisses;
        return total === 0 ? 0 : Math.round((this.totalHits / total) * 100);
    }
    // ─── Internal ────────────────────────────────────────────────
    queryKey(pid, selector) {
        return `${pid}:${JSON.stringify(selector)}`;
    }
}
//# sourceMappingURL=cache.js.map