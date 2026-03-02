/**
 * UAB Retry — Error recovery with exponential backoff.
 *
 * Phase 4: Production hardening.
 * - Exponential backoff with jitter
 * - Configurable retry conditions
 * - Operation timeout wrapper
 * - Retryable error classification
 */
import { createLogger } from './logger.js';
const log = createLogger('uab-retry');
/** Errors that are typically transient and worth retrying */
const RETRYABLE_PATTERNS = [
    /timeout/i,
    /EPIPE/,
    /ECONNRESET/,
    /ECONNREFUSED/,
    /socket hang up/i,
    /powershell.*exited/i,
    /process.*not found/i,
    /not responding/i,
];
/** Check if an error is likely transient/retryable */
export function isRetryable(error) {
    const msg = error.message;
    return RETRYABLE_PATTERNS.some(p => p.test(msg));
}
/** Execute an operation with retry and exponential backoff */
export async function withRetry(operation, options) {
    const maxRetries = options?.maxRetries ?? 2;
    const baseDelay = options?.baseDelay ?? 500;
    const maxDelay = options?.maxDelay ?? 5000;
    const jitter = options?.jitter ?? true;
    const timeout = options?.timeout ?? 30_000;
    const shouldRetry = options?.shouldRetry ?? ((err) => isRetryable(err));
    const label = options?.label ?? 'operation';
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            // Wrap with timeout
            const result = await Promise.race([
                operation(),
                new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${timeout}ms`)), timeout)),
            ]);
            return result;
        }
        catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (attempt < maxRetries && shouldRetry(lastError, attempt + 1)) {
                // Calculate delay with exponential backoff
                let delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
                if (jitter) {
                    delay += Math.random() * delay * 0.3; // 0-30% jitter
                }
                log.warn('Retrying after error', {
                    label,
                    attempt: attempt + 1,
                    maxRetries,
                    delayMs: Math.round(delay),
                    error: lastError.message,
                });
                await new Promise(r => setTimeout(r, delay));
            }
            else {
                break;
            }
        }
    }
    throw lastError;
}
/** Wrap a function to add automatic retry behavior */
export function retryable(fn, options) {
    return (...args) => withRetry(() => fn(...args), options);
}
/** Execute an operation with a timeout (no retry) */
export async function withTimeout(operation, timeoutMs, label = 'operation') {
    return Promise.race([
        operation(),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs)),
    ]);
}
//# sourceMappingURL=retry.js.map