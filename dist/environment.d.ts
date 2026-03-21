/**
 * UAB Environment Detection — Automatically adapts behavior for desktop vs server.
 *
 * Detects the runtime context and exposes a unified config so the rest of UAB
 * doesn't need to care about where it's running.
 *
 * Environments:
 *   - desktop:   Interactive Windows session (Session 1+), full UIA/CDP access
 *   - server:    Non-interactive (SSH, service, container), uses Session Bridge
 *   - container: Docker/WSL/Hyper-V, limited or no desktop access
 *
 * Usage:
 *   import { env, UABEnvironment } from './environment.js';
 *   if (env.mode === 'desktop') { ... }
 *   if (env.hasDesktop) { ... }
 */
export type RuntimeMode = 'desktop' | 'server' | 'container';
export interface EnvironmentInfo {
    /** Current runtime mode */
    mode: RuntimeMode;
    /** Whether a desktop session is reachable (directly or via bridge) */
    hasDesktop: boolean;
    /** Windows session ID (0 = non-interactive, 1+ = desktop) */
    sessionId: number;
    /** Whether running inside a container (Docker, WSL, etc.) */
    isContainer: boolean;
    /** Whether Session 0→1 bridge is needed for desktop access */
    needsBridge: boolean;
    /** Platform (always 'win32' for now) */
    platform: NodeJS.Platform;
    /** OS architecture */
    arch: string;
    /** Node.js version */
    nodeVersion: string;
}
export interface EnvironmentDefaults {
    /** Whether to use persistent connections. Desktop: true, Server: false */
    persistent: boolean;
    /** Whether to enable the Chrome extension WebSocket bridge */
    extensionBridge: boolean;
    /** Rate limit (actions per minute per PID). Desktop: 100, Server: 60 */
    rateLimit: number;
    /** Cache TTL multiplier. Server gets longer TTLs to reduce cross-session calls */
    cacheTTLMultiplier: number;
}
/**
 * Detect the current runtime environment (cached after first call).
 */
export declare function detectEnvironment(): EnvironmentInfo;
/**
 * Get environment-aware defaults for UABConnector options.
 */
export declare function getDefaults(mode?: RuntimeMode): EnvironmentDefaults;
/**
 * Reset cached environment (for testing).
 */
export declare function resetEnvironment(): void;
/** Shorthand: the current environment info. */
export declare const env: EnvironmentInfo;
//# sourceMappingURL=environment.d.ts.map