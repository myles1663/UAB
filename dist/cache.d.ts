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
import type { UIElement, ElementSelector, ActionType } from './types.js';
export interface CacheOptions {
    /** TTL for element tree cache in ms (default: 5000 = 5s) */
    treeTtl?: number;
    /** TTL for query result cache in ms (default: 3000 = 3s) */
    queryTtl?: number;
    /** TTL for app state cache in ms (default: 2000 = 2s) */
    stateTtl?: number;
    /** Max cached queries per PID (default: 50) */
    maxQueriesPerPid?: number;
}
export interface CacheStats {
    treeCacheSize: number;
    queryCacheSize: number;
    stateCacheSize: number;
    totalHits: number;
    totalMisses: number;
    invalidations: number;
}
export declare class ElementCache {
    private treeCache;
    private queryCache;
    private stateCache;
    private options;
    private totalHits;
    private totalMisses;
    private invalidations;
    constructor(options?: CacheOptions);
    /** Get cached element tree for a PID */
    getTree(pid: number): UIElement[] | null;
    /** Store element tree in cache */
    setTree(pid: number, tree: UIElement[]): void;
    /** Get cached query result */
    getQuery(pid: number, selector: ElementSelector): UIElement[] | null;
    /** Store query result in cache */
    setQuery(pid: number, selector: ElementSelector, results: UIElement[]): void;
    /** Get cached app state */
    getState(pid: number): unknown | null;
    /** Store app state in cache */
    setState(pid: number, state: unknown): void;
    /** Invalidate all caches for a PID (after mutating action) */
    invalidate(pid: number): void;
    /** Check if an action should invalidate the cache */
    shouldInvalidate(action: ActionType): boolean;
    /** Invalidate if the action is mutating */
    invalidateIfNeeded(pid: number, action: ActionType): void;
    /** Clear all caches */
    clear(): void;
    /** Remove caches for a specific PID (on disconnect) */
    remove(pid: number): void;
    /** Get cache statistics */
    getStats(): CacheStats;
    /** Get hit rate as a percentage */
    getHitRate(): number;
    private queryKey;
}
