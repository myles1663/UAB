/**
 * Chrome DevTools Protocol (CDP) Connection Manager
 *
 * Handles discovery, connection, and communication with Electron apps
 * via the Chrome DevTools Protocol.
 */
export interface CDPTarget {
    id: string;
    title: string;
    type: string;
    url: string;
    webSocketDebuggerUrl: string;
    devtoolsFrontendUrl?: string;
}
type CDPEventHandler = (params: Record<string, unknown>) => void;
export declare class CDPConnection {
    readonly host: string;
    readonly port: number;
    private ws;
    private requestId;
    private pending;
    private eventHandlers;
    private _connected;
    constructor(host?: string, port?: number);
    get connected(): boolean;
    static discoverTargets(host?: string, port?: number): Promise<CDPTarget[]>;
    static findDebugPort(pid: number): number | null;
    static getEnableCommand(appPath: string, port?: number): string;
    connect(wsUrl?: string): Promise<void>;
    send(method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>>;
    on(method: string, handler: CDPEventHandler): void;
    off(method: string, handler: CDPEventHandler): void;
    evaluate(expression: string): Promise<unknown>;
    getDocument(depth?: number): Promise<Record<string, unknown>>;
    querySelectorAll(nodeId: number, selector: string): Promise<number[]>;
    getBoxModel(nodeId: number): Promise<Record<string, unknown> | null>;
    getAttributes(nodeId: number): Promise<Record<string, string>>;
    click(x: number, y: number): Promise<void>;
    type(text: string): Promise<void>;
    enableDOM(): Promise<void>;
    enableRuntime(): Promise<void>;
    enablePage(): Promise<void>;
    disconnect(): Promise<void>;
}
export {};
//# sourceMappingURL=cdp.d.ts.map