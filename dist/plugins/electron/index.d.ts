/**
 * Electron Framework Plugin
 *
 * Connects to Electron apps via Chrome DevTools Protocol (CDP)
 * and exposes them through the UAB Unified API.
 *
 * Covers: VS Code, Slack, Discord, Spotify, Notion, Figma,
 * Teams, Obsidian, Postman, 1Password, Signal, and hundreds more.
 */
import type { FrameworkPlugin, PluginConnection, DetectedApp } from '../../types.js';
export declare class ElectronPlugin implements FrameworkPlugin {
    readonly framework: "electron";
    readonly name = "Electron (CDP)";
    canHandle(app: DetectedApp): boolean;
    connect(app: DetectedApp): Promise<PluginConnection>;
}
//# sourceMappingURL=index.d.ts.map