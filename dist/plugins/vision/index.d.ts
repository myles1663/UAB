/**
 * Vision Plugin — Screenshot + Coordinate-based Universal Fallback
 *
 * Priority 4 (last resort) in the UAB control router.
 * Works like Anthropic's computer use tool:
 *
 *   1. Capture screenshot of target window
 *   2. Send to Claude Vision API for element detection
 *   3. Map detected elements to UIElement[] with bounding boxes
 *   4. Execute actions via coordinate-based input injection
 *
 * This works with ANY application — no accessibility API, no framework
 * hooks, no special setup. Just eyes and a mouse.
 *
 * Trade-offs:
 *   - Expensive (API call per enumerate/query)
 *   - Slower (screenshot + API round-trip + input injection)
 *   - Less precise than native APIs
 *   - But UNIVERSAL — works when nothing else does
 */
import type { FrameworkPlugin, PluginConnection, DetectedApp } from '../../types.js';
import { type VisionAnalyzerOptions } from './analyzer.js';
export declare class VisionPlugin implements FrameworkPlugin {
    readonly framework: "unknown";
    readonly controlMethod: "vision";
    readonly name = "Vision (Screenshot + Coordinates)";
    private analyzerOptions?;
    constructor(options?: VisionAnalyzerOptions);
    /**
     * Vision can handle ANY app — it's the universal fallback.
     * But only if the API key is configured.
     */
    canHandle(_app: DetectedApp): boolean;
    connect(app: DetectedApp): Promise<PluginConnection>;
}
export { VisionAnalyzer, type VisionAnalyzerOptions } from './analyzer.js';
//# sourceMappingURL=index.d.ts.map