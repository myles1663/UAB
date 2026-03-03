/**
 * Browser Framework Plugin
 *
 * Connects to the user's REAL running browser (Chrome, Edge, Brave)
 * via Chrome DevTools Protocol (CDP) for full control of:
 *   - Cookies (CRUD)
 *   - localStorage / sessionStorage
 *   - Tab management (list/switch/close/new)
 *   - Navigation (goto/back/forward/reload)
 *   - DOM interaction (click, type, query — inherited from Electron plugin)
 *   - JavaScript execution
 *   - Screenshots
 *
 * IMPORTANT: The browser must be launched with --remote-debugging-port=PORT
 * or have debugging enabled. This plugin auto-discovers the debug port.
 */
import type { FrameworkPlugin, PluginConnection, DetectedApp } from '../../types.js';
export declare class BrowserPlugin implements FrameworkPlugin {
    readonly framework: "browser";
    readonly name = "Browser (CDP)";
    canHandle(app: DetectedApp): boolean;
    connect(app: DetectedApp): Promise<PluginConnection>;
}
/**
 * Check if a process name is a known browser.
 */
export declare function isBrowserProcess(processName: string): boolean;
/**
 * Get a display name for a browser process.
 */
export declare function getBrowserDisplayName(processName: string): string;
