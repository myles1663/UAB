/**
 * UAB Permissions — Safety model for destructive and sensitive actions.
 *
 * Phase 4: Security hardening.
 * - Destructive action gating (close, delete, etc.)
 * - Rate limiting per PID
 * - Action audit logging
 * - Per-app permission overrides
 */
import { createLogger } from './logger.js';
const log = createLogger('uab-perms');
/** Actions that are considered destructive and may need confirmation */
const DESTRUCTIVE_ACTIONS = new Set([
    'close',
]);
/** Actions that modify data (moderate risk) */
const MODIFYING_ACTIONS = new Set([
    'type', 'clear', 'select', 'check', 'uncheck', 'toggle',
    'keypress', 'hotkey', 'invoke',
]);
/** Actions that are read-only / low risk */
const SAFE_ACTIONS = new Set([
    'click', 'doubleclick', 'rightclick',
    'focus', 'hover', 'scroll',
    'expand', 'collapse',
    'minimize', 'maximize', 'restore',
    'move', 'resize', 'screenshot',
]);
export class PermissionManager {
    options;
    rateLimits = new Map();
    auditLog = [];
    allowedPids = new Set(); // PIDs confirmed for destructive actions
    constructor(options) {
        this.options = {
            blockDestructive: options?.blockDestructive ?? false,
            rateLimit: options?.rateLimit ?? 100,
            rateLimitWindow: options?.rateLimitWindow ?? 60_000,
            maxAuditEntries: options?.maxAuditEntries ?? 1000,
            exemptPids: options?.exemptPids ?? new Set(),
        };
    }
    /** Check if an action is permitted */
    check(pid, action, app) {
        const riskLevel = this.getRiskLevel(action);
        // Rate limit check
        if (!this.options.exemptPids.has(pid)) {
            if (this.isRateLimited(pid)) {
                return {
                    allowed: false,
                    riskLevel,
                    reason: `Rate limited: too many actions on PID ${pid} (max ${this.options.rateLimit}/min)`,
                };
            }
        }
        // Destructive action check
        if (riskLevel === 'destructive' && this.options.blockDestructive) {
            if (!this.allowedPids.has(pid)) {
                return {
                    allowed: false,
                    riskLevel,
                    reason: `Destructive action "${action}" requires confirmation for PID ${pid}` +
                        (app ? ` (${app.name})` : ''),
                };
            }
        }
        return { allowed: true, riskLevel };
    }
    /** Record an action in the rate limiter and audit log */
    record(pid, action, elementId, app, allowed, reason) {
        // Update rate limiter
        this.incrementRateLimit(pid);
        // Audit log
        const entry = {
            timestamp: Date.now(),
            pid,
            appName: app.name,
            action,
            elementId,
            riskLevel: this.getRiskLevel(action),
            allowed,
            reason,
        };
        this.auditLog.push(entry);
        // Trim audit log if over limit
        if (this.auditLog.length > this.options.maxAuditEntries) {
            this.auditLog = this.auditLog.slice(-Math.floor(this.options.maxAuditEntries * 0.8));
        }
        if (entry.riskLevel !== 'safe') {
            log.info('Action recorded', {
                pid,
                app: app.name,
                action,
                risk: entry.riskLevel,
                allowed,
            });
        }
    }
    /** Confirm a PID for destructive actions (after user approval) */
    confirmDestructive(pid) {
        this.allowedPids.add(pid);
        log.info('Destructive actions confirmed', { pid });
    }
    /** Revoke destructive action permission for a PID */
    revokeDestructive(pid) {
        this.allowedPids.delete(pid);
    }
    /** Get the risk level of an action */
    getRiskLevel(action) {
        if (DESTRUCTIVE_ACTIONS.has(action))
            return 'destructive';
        if (MODIFYING_ACTIONS.has(action))
            return 'moderate';
        return 'safe';
    }
    /** Get recent audit log entries */
    getAuditLog(limit = 50) {
        return this.auditLog.slice(-limit);
    }
    /** Get audit log for a specific PID */
    getAuditForPid(pid, limit = 50) {
        return this.auditLog
            .filter(e => e.pid === pid)
            .slice(-limit);
    }
    /** Get rate limit status for a PID */
    getRateLimitStatus(pid) {
        const entry = this.rateLimits.get(pid);
        const now = Date.now();
        if (!entry || now - entry.windowStart > this.options.rateLimitWindow) {
            return {
                count: 0,
                remaining: this.options.rateLimit,
                resetMs: 0,
            };
        }
        return {
            count: entry.count,
            remaining: Math.max(0, this.options.rateLimit - entry.count),
            resetMs: this.options.rateLimitWindow - (now - entry.windowStart),
        };
    }
    /** Clear rate limits and audit log */
    clear() {
        this.rateLimits.clear();
        this.auditLog = [];
        this.allowedPids.clear();
    }
    // ─── Internal ────────────────────────────────────────────────
    isRateLimited(pid) {
        const entry = this.rateLimits.get(pid);
        if (!entry)
            return false;
        const now = Date.now();
        if (now - entry.windowStart > this.options.rateLimitWindow) {
            // Window expired, reset
            this.rateLimits.delete(pid);
            return false;
        }
        return entry.count >= this.options.rateLimit;
    }
    incrementRateLimit(pid) {
        const now = Date.now();
        const entry = this.rateLimits.get(pid);
        if (!entry || now - entry.windowStart > this.options.rateLimitWindow) {
            this.rateLimits.set(pid, { count: 1, windowStart: now });
        }
        else {
            entry.count++;
        }
    }
}
//# sourceMappingURL=permissions.js.map