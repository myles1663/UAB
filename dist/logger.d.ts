/**
 * UAB Logger — Self-contained structured logger for the Universal App Bridge.
 *
 * This is a lightweight logger that works standalone without any
 * dependency on ClaudeClaw's logger infrastructure.
 * Writes to console only by default; file logging can be enabled
 * by setting UAB_LOG_FILE environment variable.
 */
export declare function createLogger(module: string): {
    debug: (msg: string, data?: Record<string, unknown>) => void;
    info: (msg: string, data?: Record<string, unknown>) => void;
    warn: (msg: string, data?: Record<string, unknown>) => void;
    error: (msg: string, data?: Record<string, unknown>) => void;
};
export declare function closeLogger(): void;
//# sourceMappingURL=logger.d.ts.map