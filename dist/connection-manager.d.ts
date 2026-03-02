/**
 * UAB Connection Manager — Health monitoring, auto-reconnect, stale cleanup.
 *
 * Phase 4: Production hardening for connection lifecycle.
 * - Periodic health checks on active connections
 * - Automatic reconnection on failure
 * - Stale connection cleanup
 * - Connection event callbacks
 */
import type { DetectedApp } from './types.js';
import { ControlRouter, RoutedConnection } from './router.js';
export interface ConnectionEntry {
    pid: number;
    app: DetectedApp;
    connection: RoutedConnection;
    connectedAt: number;
    lastHealthCheck: number;
    lastHealthy: number;
    healthFailures: number;
    reconnectAttempts: number;
}
export interface ConnectionManagerOptions {
    /** Health check interval in ms (default: 30000 = 30s) */
    healthCheckInterval?: number;
    /** Max consecutive health check failures before disconnect (default: 3) */
    maxHealthFailures?: number;
    /** Max reconnect attempts before giving up (default: 3) */
    maxReconnectAttempts?: number;
    /** Stale connection timeout in ms (default: 300000 = 5 min) */
    staleTimeout?: number;
}
export type ConnectionEvent = {
    type: 'connected';
    pid: number;
    app: DetectedApp;
    method: string;
} | {
    type: 'disconnected';
    pid: number;
    reason: string;
} | {
    type: 'reconnecting';
    pid: number;
    attempt: number;
} | {
    type: 'reconnected';
    pid: number;
    method: string;
} | {
    type: 'health-check-failed';
    pid: number;
    error: string;
    failures: number;
} | {
    type: 'stale-removed';
    pid: number;
};
export type ConnectionEventCallback = (event: ConnectionEvent) => void;
export declare class ConnectionManager {
    private entries;
    private router;
    private options;
    private healthTimer;
    private listeners;
    constructor(router: ControlRouter, options?: ConnectionManagerOptions);
    /** Start health monitoring loop */
    startMonitoring(): void;
    /** Stop health monitoring loop */
    stopMonitoring(): void;
    /** Register a connection event listener */
    onEvent(callback: ConnectionEventCallback): () => void;
    /** Track a new connection */
    track(pid: number, app: DetectedApp, connection: RoutedConnection): void;
    /** Untrack a connection */
    untrack(pid: number, reason?: string): void;
    /** Get a tracked connection entry */
    get(pid: number): ConnectionEntry | undefined;
    /** Get all tracked entries */
    getAll(): ConnectionEntry[];
    /** Get connection health summary */
    getHealthSummary(): Array<{
        pid: number;
        name: string;
        healthy: boolean;
        uptimeMs: number;
        failures: number;
        method: string;
    }>;
    /** Run health checks on all connections */
    runHealthChecks(): Promise<void>;
    /** Attempt to reconnect a failed connection */
    private tryReconnect;
    /** Clean up all connections and stop monitoring */
    shutdown(): Promise<void>;
    private emit;
}
//# sourceMappingURL=connection-manager.d.ts.map