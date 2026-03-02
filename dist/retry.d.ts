/**
 * UAB Retry — Error recovery with exponential backoff.
 *
 * Phase 4: Production hardening.
 * - Exponential backoff with jitter
 * - Configurable retry conditions
 * - Operation timeout wrapper
 * - Retryable error classification
 */
export interface RetryOptions {
    /** Max retries (default: 2) */
    maxRetries?: number;
    /** Base delay in ms (default: 500) */
    baseDelay?: number;
    /** Max delay cap in ms (default: 5000) */
    maxDelay?: number;
    /** Add random jitter (default: true) */
    jitter?: boolean;
    /** Operation timeout in ms (default: 30000) */
    timeout?: number;
    /** Custom retry condition — return true to retry (default: retry on all errors) */
    shouldRetry?: (error: Error, attempt: number) => boolean;
    /** Label for logging */
    label?: string;
}
/** Check if an error is likely transient/retryable */
export declare function isRetryable(error: Error): boolean;
/** Execute an operation with retry and exponential backoff */
export declare function withRetry<T>(operation: () => Promise<T>, options?: RetryOptions): Promise<T>;
/** Wrap a function to add automatic retry behavior */
export declare function retryable<TArgs extends unknown[], TReturn>(fn: (...args: TArgs) => Promise<TReturn>, options?: RetryOptions): (...args: TArgs) => Promise<TReturn>;
/** Execute an operation with a timeout (no retry) */
export declare function withTimeout<T>(operation: () => Promise<T>, timeoutMs: number, label?: string): Promise<T>;
