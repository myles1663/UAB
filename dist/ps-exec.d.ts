/**
 * Shared PowerShell execution utilities for UAB plugins.
 *
 * Uses temp files for script execution to avoid command line length limits
 * and all escaping issues with quotes, newlines, and special chars.
 *
 * Session Bridge: When running from Session 0 (non-interactive, e.g. via
 * SSH or service), desktop window APIs (EnumWindows, UIA, etc.) fail because
 * they can't see Session 1's desktop. The interactive execution functions
 * use Windows Task Scheduler to run scripts in the user's interactive session.
 */
/**
 * Check if we're running in Session 0 (non-interactive).
 * Caches the result since session ID doesn't change during execution.
 */
export declare function isSession0(): boolean;
/**
 * Execute a PowerShell script and parse the JSON output.
 */
export declare function runPSJson(script: string, timeoutMs?: number): unknown;
/**
 * Execute a PowerShell script and return raw stdout text.
 */
export declare function runPSRaw(script: string, timeoutMs?: number): string;
/**
 * Execute a PowerShell script in the interactive desktop session and parse JSON output.
 * Uses the session bridge (schtasks) when in Session 0.
 * Falls back to direct execution when already in an interactive session.
 */
export declare function runPSJsonInteractive(script: string, timeoutMs?: number): unknown;
/**
 * Execute a PowerShell script in the interactive desktop session and return raw text.
 * Uses the session bridge (schtasks) when in Session 0.
 * Falls back to direct execution when already in an interactive session.
 */
export declare function runPSRawInteractive(script: string, timeoutMs?: number): string;
//# sourceMappingURL=ps-exec.d.ts.map