/**
 * UAB Connection Manager — Health monitoring, auto-reconnect, stale cleanup.
 *
 * Phase 4: Production hardening for connection lifecycle.
 * - Periodic health checks on active connections
 * - Automatic reconnection on failure
 * - Stale connection cleanup
 * - Connection event callbacks
 */
import { createLogger } from './logger.js';
const log = createLogger('uab-connmgr');
export class ConnectionManager {
    entries = new Map();
    router;
    options;
    healthTimer = null;
    listeners = [];
    constructor(router, options) {
        this.router = router;
        this.options = {
            healthCheckInterval: options?.healthCheckInterval ?? 30_000,
            maxHealthFailures: options?.maxHealthFailures ?? 3,
            maxReconnectAttempts: options?.maxReconnectAttempts ?? 3,
            staleTimeout: options?.staleTimeout ?? 300_000,
        };
    }
    /** Start health monitoring loop */
    startMonitoring() {
        if (this.healthTimer)
            return;
        this.healthTimer = setInterval(() => {
            this.runHealthChecks().catch(err => {
                log.error('Health check loop error', { error: String(err) });
            });
        }, this.options.healthCheckInterval);
        log.info('Connection health monitoring started', {
            intervalMs: this.options.healthCheckInterval,
        });
    }
    /** Stop health monitoring loop */
    stopMonitoring() {
        if (this.healthTimer) {
            clearInterval(this.healthTimer);
            this.healthTimer = null;
            log.info('Connection health monitoring stopped');
        }
    }
    /** Register a connection event listener */
    onEvent(callback) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }
    /** Track a new connection */
    track(pid, app, connection) {
        const now = Date.now();
        this.entries.set(pid, {
            pid,
            app,
            connection,
            connectedAt: now,
            lastHealthCheck: now,
            lastHealthy: now,
            healthFailures: 0,
            reconnectAttempts: 0,
        });
        this.emit({ type: 'connected', pid, app, method: connection.method });
    }
    /** Untrack a connection */
    untrack(pid, reason = 'manual') {
        if (this.entries.has(pid)) {
            this.entries.delete(pid);
            this.emit({ type: 'disconnected', pid, reason });
        }
    }
    /** Get a tracked connection entry */
    get(pid) {
        return this.entries.get(pid);
    }
    /** Get all tracked entries */
    getAll() {
        return Array.from(this.entries.values());
    }
    /** Get connection health summary */
    getHealthSummary() {
        const now = Date.now();
        return this.getAll().map(entry => ({
            pid: entry.pid,
            name: entry.app.name,
            healthy: entry.healthFailures === 0,
            uptimeMs: now - entry.connectedAt,
            failures: entry.healthFailures,
            method: entry.connection.method,
        }));
    }
    /** Run health checks on all connections */
    async runHealthChecks() {
        const now = Date.now();
        const entries = this.getAll();
        for (const entry of entries) {
            try {
                // Quick health check — try to get app state
                await Promise.race([
                    entry.connection.state(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('health check timeout')), 5000)),
                ]);
                // Healthy
                entry.lastHealthCheck = now;
                entry.lastHealthy = now;
                entry.healthFailures = 0;
            }
            catch (err) {
                entry.lastHealthCheck = now;
                entry.healthFailures++;
                const errorMsg = err instanceof Error ? err.message : String(err);
                log.warn('Health check failed', {
                    pid: entry.pid,
                    name: entry.app.name,
                    failures: entry.healthFailures,
                    error: errorMsg,
                });
                this.emit({
                    type: 'health-check-failed',
                    pid: entry.pid,
                    error: errorMsg,
                    failures: entry.healthFailures,
                });
                // Too many failures — try to reconnect
                if (entry.healthFailures >= this.options.maxHealthFailures) {
                    await this.tryReconnect(entry);
                }
            }
            // Check for stale connections (no successful health check in a long time)
            if (now - entry.lastHealthy > this.options.staleTimeout) {
                log.warn('Removing stale connection', {
                    pid: entry.pid,
                    name: entry.app.name,
                    staleSinceMs: now - entry.lastHealthy,
                });
                try {
                    await entry.connection.disconnect();
                }
                catch { /* best effort */ }
                this.entries.delete(entry.pid);
                this.emit({ type: 'stale-removed', pid: entry.pid });
            }
        }
    }
    /** Attempt to reconnect a failed connection */
    async tryReconnect(entry) {
        if (entry.reconnectAttempts >= this.options.maxReconnectAttempts) {
            log.error('Max reconnect attempts reached, giving up', {
                pid: entry.pid,
                name: entry.app.name,
                attempts: entry.reconnectAttempts,
            });
            try {
                await entry.connection.disconnect();
            }
            catch { /* best effort */ }
            this.entries.delete(entry.pid);
            this.emit({ type: 'disconnected', pid: entry.pid, reason: 'max-reconnect-attempts' });
            return false;
        }
        entry.reconnectAttempts++;
        this.emit({ type: 'reconnecting', pid: entry.pid, attempt: entry.reconnectAttempts });
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.min(1000 * Math.pow(2, entry.reconnectAttempts - 1), 8000);
        await new Promise(r => setTimeout(r, delay));
        try {
            // Disconnect old connection
            try {
                await entry.connection.disconnect();
            }
            catch { /* best effort */ }
            // Reconnect
            const newConn = await this.router.connect(entry.app);
            const now = Date.now();
            entry.connection = newConn;
            entry.lastHealthy = now;
            entry.lastHealthCheck = now;
            entry.healthFailures = 0;
            entry.reconnectAttempts = 0;
            log.info('Reconnected successfully', {
                pid: entry.pid,
                name: entry.app.name,
                method: newConn.method,
            });
            this.emit({ type: 'reconnected', pid: entry.pid, method: newConn.method });
            return true;
        }
        catch (err) {
            log.error('Reconnect attempt failed', {
                pid: entry.pid,
                attempt: entry.reconnectAttempts,
                error: err instanceof Error ? err.message : String(err),
            });
            return false;
        }
    }
    /** Clean up all connections and stop monitoring */
    async shutdown() {
        this.stopMonitoring();
        for (const entry of this.getAll()) {
            try {
                await entry.connection.disconnect();
            }
            catch { /* best effort */ }
        }
        this.entries.clear();
        this.listeners = [];
    }
    emit(event) {
        for (const listener of this.listeners) {
            try {
                listener(event);
            }
            catch { /* ignore callback errors */ }
        }
    }
}
//# sourceMappingURL=connection-manager.js.map