/**
 * UAB Permissions — Safety model for destructive and sensitive actions.
 *
 * Phase 4: Security hardening.
 * - Destructive action gating (close, delete, etc.)
 * - Rate limiting per PID
 * - Action audit logging
 * - Per-app permission overrides
 */
import type { ActionType, DetectedApp } from './types.js';
export type RiskLevel = 'safe' | 'moderate' | 'destructive';
export interface PermissionCheck {
    allowed: boolean;
    riskLevel: RiskLevel;
    reason?: string;
}
export interface RateLimitEntry {
    count: number;
    windowStart: number;
}
export interface AuditEntry {
    timestamp: number;
    pid: number;
    appName: string;
    action: ActionType;
    elementId: string;
    riskLevel: RiskLevel;
    allowed: boolean;
    reason?: string;
}
export interface PermissionOptions {
    /** Whether to block destructive actions (default: false — just log them) */
    blockDestructive?: boolean;
    /** Rate limit: max actions per PID per window (default: 100) */
    rateLimit?: number;
    /** Rate limit window in ms (default: 60000 = 1 minute) */
    rateLimitWindow?: number;
    /** Max audit log entries to keep in memory (default: 1000) */
    maxAuditEntries?: number;
    /** PIDs that are exempt from rate limiting */
    exemptPids?: Set<number>;
}
export declare class PermissionManager {
    private options;
    private rateLimits;
    private auditLog;
    private allowedPids;
    constructor(options?: PermissionOptions);
    /** Check if an action is permitted */
    check(pid: number, action: ActionType, app?: DetectedApp): PermissionCheck;
    /** Record an action in the rate limiter and audit log */
    record(pid: number, action: ActionType, elementId: string, app: DetectedApp, allowed: boolean, reason?: string): void;
    /** Confirm a PID for destructive actions (after user approval) */
    confirmDestructive(pid: number): void;
    /** Revoke destructive action permission for a PID */
    revokeDestructive(pid: number): void;
    /** Get the risk level of an action */
    getRiskLevel(action: ActionType): RiskLevel;
    /** Get recent audit log entries */
    getAuditLog(limit?: number): AuditEntry[];
    /** Get audit log for a specific PID */
    getAuditForPid(pid: number, limit?: number): AuditEntry[];
    /** Get rate limit status for a PID */
    getRateLimitStatus(pid: number): {
        count: number;
        remaining: number;
        resetMs: number;
    };
    /** Clear rate limits and audit log */
    clear(): void;
    private isRateLimited;
    private incrementRateLimit;
}
