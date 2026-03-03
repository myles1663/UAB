/**
 * Chrome Extension Bridge Plugin
 *
 * Connects to Chrome/Edge/Brave via a locally-installed extension
 * that communicates over WebSocket. NO browser relaunch required.
 *
 * Falls through to the CDP-based BrowserPlugin if the extension
 * is not connected, providing a graceful degradation path.
 *
 * Priority: ChromeExtPlugin > BrowserPlugin (CDP)
 */
import type { FrameworkPlugin, PluginConnection, DetectedApp } from '../../types.js';
import { ExtensionWSServer } from './ws-server.js';
export declare class ChromeExtPlugin implements FrameworkPlugin {
    readonly framework: "browser";
    readonly name = "Chrome Extension Bridge";
    private wsServer;
    private connections;
    constructor(wsServer: ExtensionWSServer);
    canHandle(app: DetectedApp): boolean;
    connect(app: DetectedApp): Promise<PluginConnection>;
}
