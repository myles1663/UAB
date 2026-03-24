/**
 * UAB Spatial Map Engine
 *
 * Converts flat UIElement[] with bounding rects into a spatial index
 * that enables fast positional queries, row/column detection, and
 * generates compact text-based maps for AI consumption.
 *
 * This is the CORE of UAB's speed advantage over vision-only approaches:
 * - Data > screenshots (AI processes structured data faster than images)
 * - Bounding rects are FREE from UIA (no extra API calls)
 * - Spatial map eliminates the need for screenshots in most cases
 * - Vision becomes complementary, not primary
 */
import type { UIElement, Bounds, ElementType } from './types.js';
export interface SpatialElement {
    id: string;
    type: ElementType;
    label: string;
    bounds: Bounds;
    center: {
        x: number;
        y: number;
    };
    actions: string[];
    visible: boolean;
    enabled: boolean;
    text?: string;
    value?: string;
    row?: number;
    col?: number;
}
export interface SpatialRow {
    index: number;
    y: number;
    height: number;
    elements: SpatialElement[];
}
export interface SpatialMap {
    pid: number;
    windowBounds: Bounds;
    totalElements: number;
    rows: SpatialRow[];
    grid: SpatialElement[][];
    timestamp: number;
}
export interface SpatialQuery {
    /** Find elements near a point */
    nearPoint?: {
        x: number;
        y: number;
        radius?: number;
    };
    /** Find elements in a rectangular region */
    inRegion?: Bounds;
    /** Find elements in a specific row */
    row?: number;
    /** Find elements by type */
    type?: ElementType;
    /** Find elements by label (substring match) */
    label?: string;
    /** Limit results */
    limit?: number;
}
export interface NearestResult {
    element: SpatialElement;
    distance: number;
    direction: 'above' | 'below' | 'left' | 'right' | 'overlapping';
}
/**
 * Build a complete spatial map from a UI element tree.
 */
export declare function buildSpatialMap(pid: number, tree: UIElement[], windowBounds: Bounds, options?: {
    maxDepth?: number;
    rowThreshold?: number;
}): SpatialMap;
export declare class SpatialIndex {
    private elements;
    private gridIndex;
    private map;
    constructor(map: SpatialMap);
    /** Find elements near a point (fast grid-based lookup). */
    nearPoint(x: number, y: number, radius?: number): NearestResult[];
    /** Find the single nearest element to a point. */
    nearest(x: number, y: number): NearestResult | null;
    /** Find all elements within a rectangular region. */
    inRegion(region: Bounds): SpatialElement[];
    /** Get elements from a specific visual row. */
    row(index: number): SpatialElement[];
    /** Run a compound spatial query. */
    query(q: SpatialQuery): SpatialElement[];
    /** Get all elements. */
    all(): SpatialElement[];
    /** Get the underlying map. */
    getMap(): SpatialMap;
    /** How many elements in the index. */
    get size(): number;
}
/**
 * Generate a compact text-based representation of the spatial map.
 * This is what gets sent to the AI instead of a screenshot.
 *
 * Format:
 * ```
 * === SPATIAL MAP (PID 1234) — 45 elements, 8 rows ===
 * Window: 1920×1080 at (0,0)
 *
 * ROW 0 (y:0-32) — Title Bar
 *   [button "Close" @(1880,8 32×24)] [button "Maximize" @(1848,8 32×24)]
 *
 * ROW 1 (y:33-56) — Menu Bar
 *   [menuitem "File" @(8,36 48×20)] [menuitem "Edit" @(56,36 48×20)]
 * ```
 */
export declare function renderTextMap(map: SpatialMap, options?: {
    /** Include bounds coordinates (default: true) */
    showBounds?: boolean;
    /** Include action list (default: false — too verbose) */
    showActions?: boolean;
    /** Max elements per row to show (default: 20) */
    maxPerRow?: number;
    /** Include text/value content (default: true) */
    showContent?: boolean;
    /** Compact single-line format (default: false) */
    compact?: boolean;
}): string;
/**
 * Generate a JSON-optimized map output for CLI/API consumption.
 * Includes all data but in a flat, easily-parseable structure.
 */
export declare function renderJsonMap(map: SpatialMap): object;
//# sourceMappingURL=spatial.d.ts.map