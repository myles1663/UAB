/**
 * UAB Composite Query Engine
 *
 * The fastest, most capable method of computer use.
 *
 * Combines ALL available data sources in speed-priority order:
 *   1. UIA Tree     (⚡ instant) — element IDs, types, states, structure
 *   2. Bounding Rects (⚡ instant) — spatial positions, sizes → spatial map
 *   3. Text Reading  (⚡ fast) — TextPattern/ValuePattern content extraction
 *   4. Vision        (🐌 slow) — screenshot + Claude Vision (ONLY when needed)
 *
 * Philosophy:
 *   - Data is FASTER than images for AI to process
 *   - The spatial map REPLACES screenshots in most cases
 *   - Vision is complementary (verification, complex visuals), not primary
 *   - Every extra tool closes another gap — use ALL of them
 */
import type { UABConnector } from './connector.js';
import type { ActionResult, AppState } from './types.js';
import { SpatialIndex } from './spatial.js';
import type { SpatialMap, SpatialElement } from './spatial.js';
export interface CompositeResult {
    pid: number;
    /** The spatial map (rows, grid, indexed) */
    spatialMap: SpatialMap;
    /** Spatial index for fast queries */
    index: SpatialIndex;
    /** Text content extracted from elements (id → text) */
    textContent: Map<string, string>;
    /** Window state */
    appState: AppState;
    /** Performance timing */
    timing: {
        enumerateMs: number;
        spatialBuildMs: number;
        textReadMs: number;
        totalMs: number;
        visionMs?: number;
    };
    /** How many elements have text content */
    textEnrichedCount: number;
}
export interface CompositeOptions {
    /** Max tree depth for enumeration (default: 12) */
    maxDepth?: number;
    /** Row clustering threshold in pixels (default: 15) */
    rowThreshold?: number;
    /** Read text content from elements (default: true) */
    readText?: boolean;
    /** Max elements to attempt text reading on (default: 200) */
    textReadLimit?: number;
    /** Element types to read text from (default: text-bearing types) */
    textTypes?: string[];
    /** Also capture a screenshot for vision verification (default: false) */
    includeVision?: boolean;
    /** Output format for text map (default: 'detailed') */
    mapFormat?: 'detailed' | 'compact' | 'json';
}
export declare class CompositeEngine {
    private connector;
    constructor(connector: UABConnector);
    /**
     * Run a full composite query on a connected app.
     * Returns spatial map + text content + app state in one call.
     */
    query(pid: number, options?: CompositeOptions): Promise<CompositeResult>;
    /**
     * Quick spatial map — skip text reading for maximum speed.
     * Use when you just need positions, not content.
     */
    quickMap(pid: number): Promise<{
        map: SpatialMap;
        index: SpatialIndex;
        timing: number;
    }>;
    /**
     * Generate a text map string for AI consumption.
     * This is the primary output — replaces screenshots.
     */
    textMap(pid: number, options?: CompositeOptions & {
        format?: 'detailed' | 'compact' | 'json';
    }): Promise<{
        text: string;
        timing: number;
    }>;
    /**
     * Find an element by description using the spatial map.
     * Faster than screenshot-based element finding.
     */
    findElement(pid: number, description: string): Promise<SpatialElement[]>;
    /**
     * Click the nearest matching element.
     * Spatial-map-first approach (no screenshots needed).
     */
    clickElement(pid: number, description: string): Promise<ActionResult>;
    /**
     * Type into the nearest matching text field.
     */
    typeInto(pid: number, fieldDescription: string, text: string): Promise<ActionResult>;
    /**
     * Enrich spatial elements with text content.
     *
     * Strategy (speed-first):
     * 1. Labels ARE text — most elements already have their text in el.label (FREE)
     * 2. Only call readDocument on textareas/textfields — these are the ones
     *    where the label says "Text editor" but the actual content is different
     * 3. This keeps text enrichment under 1-2 seconds instead of 80+
     */
    private enrichWithText;
}
//# sourceMappingURL=composite.d.ts.map