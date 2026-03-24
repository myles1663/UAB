/**
 * Chrome Extension WebSocket Bridge Server
 *
 * Runs a local WebSocket server that the Chrome extension connects to.
 * Provides a request/response interface for sending commands to the
 * extension and receiving results.
 *
 * Protocol:
 *   Server → Extension: { id, method, params }
 *   Extension → Server: { id, result } or { id, error }
 *   Extension → Server: { type: "hello", version, browser }
 *   Server → Extension: { type: "welcome" }
 *   Server → Extension: { type: "ping" }
 *   Extension → Server: { type: "pong" } or { type: "heartbeat" }
 */
export interface ExtensionInfo {
    version: string;
    browser: string;
    connectedAt: number;
}
export declare class ExtensionWSServer {
    private wss;
    private client;
    private extensionInfo;
    private pendingRequests;
    private nextId;
    private pingTimer;
    private readonly port;
    private readonly commandTimeout;
    constructor(port?: number, commandTimeout?: number);
    /** Start the WebSocket server */
    start(): Promise<void>;
    /** Stop the WebSocket server */
    stop(): Promise<void>;
    /** Check if an extension is connected */
    get connected(): boolean;
    /** Get info about the connected extension */
    get info(): ExtensionInfo | null;
    /**
     * Send a command to the extension and wait for the result.
     *
     * @param method - Command method (e.g., "tabs.list", "dom.click")
     * @param params - Command parameters
     * @returns The result from the extension
     */
    send(method: string, params?: Record<string, unknown>): Promise<unknown>;
    private handleConnection;
    private handleMessage;
    private startPingLoop;
}
//# sourceMappingURL=ws-server.d.ts.map