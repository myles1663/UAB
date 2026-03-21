/**
 * UAB HTTP Server — Server-side endpoint for remote UAB access.
 *
 * Wraps UABConnector in a lightweight HTTP server so agents running
 * on a different machine (or in a container) can control desktop apps
 * on the host via REST calls.
 *
 * Architecture:
 *   - Uses Node's built-in `http` module (ZERO dependencies)
 *   - Each request gets its own context (stateless by default)
 *   - Shared UABConnector instance with connection pooling
 *   - JSON request/response only
 *   - Localhost-only by default (security)
 *
 * Usage:
 *   import { UABServer } from './server.js';
 *   const server = new UABServer({ port: 3100 });
 *   await server.start();
 *   // Clients: POST http://localhost:3100/scan
 *   //          POST http://localhost:3100/connect { "target": "notepad" }
 *   //          POST http://localhost:3100/query { "pid": 1234, "selector": { "type": "button" } }
 *   await server.stop();
 *
 * @example
 * ```bash
 * # From any HTTP client / agent:
 * curl -X POST http://localhost:3100/scan
 * curl -X POST http://localhost:3100/connect -d '{"target":"notepad"}'
 * curl -X POST http://localhost:3100/query -d '{"pid":1234,"selector":{"type":"button"}}'
 * curl -X POST http://localhost:3100/act -d '{"pid":1234,"elementId":"btn_1","action":"click"}'
 * ```
 */
import { type ConnectorOptions } from './connector.js';
export interface ServerOptions {
    /** Port to listen on. Default: 3100 */
    port?: number;
    /** Host to bind to. Default: '127.0.0.1' (localhost only) */
    host?: string;
    /** API key for authentication. If set, requires X-API-Key header. */
    apiKey?: string;
    /** Connector options override. Auto-detected if not set. */
    connector?: ConnectorOptions;
    /** Max request body size in bytes. Default: 1MB */
    maxBodySize?: number;
}
export declare class UABServer {
    private server;
    private connector;
    private routes;
    private opts;
    private environment;
    constructor(options?: ServerOptions);
    start(): Promise<void>;
    stop(): Promise<void>;
    get running(): boolean;
    get address(): string;
    private handleRequest;
    private readBody;
    private sendJSON;
    private sendError;
    private registerRoutes;
}
//# sourceMappingURL=server.d.ts.map