/**
 * Vision Analyzer — Screenshot → UIElement[] via Claude Vision API
 *
 * Takes a screenshot image and sends it to Claude's vision model
 * to identify all visible UI elements with their bounding boxes.
 * This is the "eyes" of the Vision fallback — expensive but universal.
 *
 * Uses Claude claude-sonnet-4-20250514 for cost efficiency (vision analysis
 * doesn't need Opus-level reasoning).
 */
import type { UIElement } from '../../types.js';
export interface VisionAnalyzerOptions {
    /** Anthropic API key. Falls back to ANTHROPIC_API_KEY env var. */
    apiKey?: string;
    /** Model to use for vision analysis. Default: claude-sonnet-4-20250514 */
    model?: string;
    /** Max tokens for response. Default: 4096 */
    maxTokens?: number;
}
export declare class VisionAnalyzer {
    private client;
    private model;
    private maxTokens;
    private apiKey;
    constructor(options?: VisionAnalyzerOptions);
    /**
     * Check if the analyzer is configured (has API key).
     */
    get available(): boolean;
    /**
     * Analyze a screenshot and return identified UI elements.
     *
     * @param base64Image - PNG image as base64 string
     * @param windowBounds - The absolute screen position of the window
     *                       (used to convert relative coords to absolute)
     */
    analyze(base64Image: string, windowBounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    }): Promise<UIElement[]>;
    /**
     * Parse the Claude response into raw element objects.
     */
    private parseResponse;
    /**
     * Convert raw vision elements to UAB UIElement format.
     * Adds absolute screen coordinates and generates IDs.
     */
    private mapToUIElements;
    /**
     * Map string type names to ElementType.
     */
    private mapElementType;
    /**
     * Infer available actions based on element type.
     */
    private inferActions;
}
//# sourceMappingURL=analyzer.d.ts.map