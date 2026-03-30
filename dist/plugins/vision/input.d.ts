/**
 * Vision Input Injection — Coordinate-based mouse & keyboard via Win32 API
 *
 * Provides low-level input injection for the Vision fallback:
 *   - Mouse: click, double-click, right-click, hover at (x, y)
 *   - Keyboard: keypress, hotkey combos, text typing
 *   - Window: foreground management
 *
 * Uses PowerShell → C# P/Invoke to call user32.dll directly.
 * This works with ANY window regardless of framework or accessibility support.
 */
import type { ActionResult } from '../../types.js';
/**
 * Click at absolute screen coordinates.
 */
export declare function clickAt(pid: number, x: number, y: number): ActionResult;
/**
 * Double-click at absolute screen coordinates.
 */
export declare function doubleClickAt(pid: number, x: number, y: number): ActionResult;
/**
 * Right-click at absolute screen coordinates.
 */
export declare function rightClickAt(pid: number, x: number, y: number): ActionResult;
/**
 * Hover (move cursor) to absolute screen coordinates.
 */
export declare function hoverAt(pid: number, x: number, y: number): ActionResult;
/**
 * Drag along a path of coordinates — P6 OS raw input injection.
 * Moves to start, holds button, traverses waypoints, releases.
 * button: 'left' (default), 'middle', 'right'
 * stepDelay controls speed in ms between waypoints (default 10ms).
 */
export declare function dragPath(pid: number, path: Array<{
    x: number;
    y: number;
}>, stepDelay?: number, button?: 'left' | 'middle' | 'right'): ActionResult;
/**
 * Scroll at absolute coordinates using mouse wheel injection.
 * amount > 0 scrolls up, amount < 0 scrolls down. Each unit = 120 (one notch).
 */
export declare function scrollAt(pid: number, x: number, y: number, amount: number): ActionResult;
/**
 * Send a single keypress to the foreground window.
 */
export declare function sendKeypress(pid: number, key: string): ActionResult;
/**
 * Send a hotkey combination (e.g., ['ctrl', 's']).
 */
export declare function sendHotkey(pid: number, keys: string[]): ActionResult;
/**
 * Type text into the currently focused element.
 * Clicks at coordinates first to ensure focus, then types.
 */
export declare function typeTextAt(pid: number, x: number, y: number, text: string): ActionResult;
/**
 * Type a full string into the focused window in one shot.
 * Brings the window to foreground first, then sends all text at once.
 * Much faster than per-character keypress — one call for any length string.
 */
export declare function typeText(pid: number, text: string): ActionResult;
/**
 * Window management via Win32 API.
 */
export declare function windowAction(pid: number, action: 'minimize' | 'maximize' | 'restore' | 'close'): ActionResult;
/**
 * Capture a screenshot of a window by PID.
 * Returns the file path and base64-encoded image data.
 */
export declare function captureScreenshot(pid: number, outputPath: string): {
    success: boolean;
    path?: string;
    base64?: string;
    width?: number;
    height?: number;
    error?: string;
};
/**
 * Get window bounds (position + size) for a PID.
 */
export declare function getWindowBounds(pid: number): {
    success: boolean;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    title?: string;
    error?: string;
};
//# sourceMappingURL=input.d.ts.map