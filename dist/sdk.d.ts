/**
 * UAB Agent SDK — Dead-simple wrapper that's easier to use than screenshots.
 *
 * The whole point: if using UAB is EASIER than taking a screenshot,
 * agents will naturally prefer it. This SDK makes the common cases trivial.
 *
 * @example
 * ```ts
 * import { desktop } from './sdk.js';
 *
 * // One-liner: click a button in any app
 * await desktop.click('Notepad', 'File');
 *
 * // Type into a field
 * await desktop.type('Notepad', 'Edit area', 'Hello world');
 *
 * // Get what's on screen (no screenshot needed)
 * const layout = await desktop.look('Notepad');
 *
 * // Full workflow
 * await desktop.do('Notepad', [
 *   { click: 'File' },
 *   { click: 'Save As...' },
 *   { type: { field: 'File name', text: 'document.txt' } },
 *   { click: 'Save' },
 * ]);
 * ```
 */
import type { UIElement, ActionResult } from './types.js';
interface ClickStep {
    click: string;
}
interface TypeStep {
    type: {
        field: string;
        text: string;
    };
}
interface HotkeyStep {
    hotkey: string;
}
interface KeyStep {
    key: string;
}
interface WaitStep {
    wait: number;
}
type WorkflowStep = ClickStep | TypeStep | HotkeyStep | KeyStep | WaitStep;
interface AppHandle {
    pid: number;
    name: string;
}
export declare class AgentSDK {
    private connector;
    private started;
    private connected;
    constructor();
    /** Ensure connector is running */
    private ensureStarted;
    /** Resolve app name to PID, connecting if needed */
    private resolve;
    /**
     * Look at an app's UI — returns structured text layout.
     * This replaces screenshots for 90% of use cases.
     */
    look(app: string | number): Promise<string>;
    /**
     * Click an element by name. Uses smart 6-method fallback.
     */
    click(app: string | number, elementName: string): Promise<{
        success: boolean;
        method: string;
    }>;
    /**
     * Type text into a field. Finds the field by name, clears it, and types.
     */
    type(app: string | number, fieldName: string, text: string): Promise<ActionResult>;
    /**
     * Send a keyboard shortcut (e.g., "ctrl+s", "alt+f4").
     */
    shortcut(app: string | number, keys: string): Promise<ActionResult>;
    /**
     * Send a single key press (e.g., "enter", "escape", "tab").
     */
    key(app: string | number, key: string): Promise<ActionResult>;
    /**
     * Find UI elements matching criteria.
     */
    find(app: string | number, options?: {
        type?: string;
        label?: string;
        visible?: boolean;
    }): Promise<UIElement[]>;
    /**
     * Get current app state (window position, title, focused element).
     */
    status(app: string | number): Promise<any>;
    /**
     * Get list of running apps.
     */
    apps(): Promise<AppHandle[]>;
    /**
     * Execute a multi-step workflow in plain English.
     *
     * @example
     * ```ts
     * await desktop.do('Notepad', [
     *   { click: 'File' },
     *   { click: 'Save As...' },
     *   { type: { field: 'File name', text: 'doc.txt' } },
     *   { click: 'Save' },
     * ]);
     * ```
     */
    do(app: string | number, steps: WorkflowStep[]): Promise<{
        success: boolean;
        stepsCompleted: number;
        results: Array<{
            step: number;
            success: boolean;
            error?: string;
        }>;
    }>;
    /**
     * Shut down the SDK and disconnect from all apps.
     */
    shutdown(): Promise<void>;
}
/** Pre-configured SDK instance — just import and use */
export declare const desktop: AgentSDK;
export {};
//# sourceMappingURL=sdk.d.ts.map