/**
 * UAB Action Chains — Multi-step workflow execution engine.
 *
 * Phase 4: Automation workflows.
 * - Sequential action chains with verification between steps
 * - Wait-for-element conditions (poll until element appears)
 * - Conditional branching (if element exists, do X)
 * - Step-level error handling and rollback
 * - Named chains for reusability
 */
import type { ElementSelector, ActionType, ActionParams, ActionResult } from './types.js';
import type { UABService } from './service.js';
export interface ActionStep {
    type: 'action';
    /** Element selector to find the target */
    selector: ElementSelector;
    /** Action to perform */
    action: ActionType;
    /** Action parameters */
    params?: ActionParams;
    /** Optional label for logging */
    label?: string;
}
export interface WaitStep {
    type: 'wait';
    /** Element selector to wait for */
    selector: ElementSelector;
    /** Max time to wait in ms (default: 10000) */
    timeoutMs?: number;
    /** Poll interval in ms (default: 500) */
    pollMs?: number;
    /** Wait for element to disappear instead */
    waitForAbsence?: boolean;
    label?: string;
}
export interface ConditionalStep {
    type: 'conditional';
    /** Element selector to check */
    selector: ElementSelector;
    /** Steps to run if element exists */
    ifPresent: ChainStep[];
    /** Steps to run if element does not exist */
    ifAbsent?: ChainStep[];
    label?: string;
}
export interface DelayStep {
    type: 'delay';
    /** Delay in ms */
    ms: number;
    label?: string;
}
export interface KeypressStep {
    type: 'keypress';
    key: string;
    label?: string;
}
export interface HotkeyStep {
    type: 'hotkey';
    keys: string[];
    label?: string;
}
export interface TypeTextStep {
    type: 'typeText';
    /** Element selector to find the target input */
    selector: ElementSelector;
    /** Text to type */
    text: string;
    /** Clear field first */
    clearFirst?: boolean;
    label?: string;
}
export type ChainStep = ActionStep | WaitStep | ConditionalStep | DelayStep | KeypressStep | HotkeyStep | TypeTextStep;
export interface ChainDefinition {
    /** Human-readable chain name */
    name: string;
    /** Target app PID */
    pid: number;
    /** Ordered steps to execute */
    steps: ChainStep[];
    /** Stop chain on first error (default: true) */
    stopOnError?: boolean;
    /** Delay between steps in ms (default: 200) */
    stepDelay?: number;
}
export interface StepResult {
    stepIndex: number;
    step: ChainStep;
    success: boolean;
    result?: ActionResult;
    error?: string;
    durationMs: number;
    skipped?: boolean;
}
export interface ChainResult {
    name: string;
    success: boolean;
    stepsCompleted: number;
    totalSteps: number;
    steps: StepResult[];
    durationMs: number;
    error?: string;
}
export declare class ChainExecutor {
    private uab;
    constructor(uab: UABService);
    /** Execute a chain definition */
    execute(chain: ChainDefinition): Promise<ChainResult>;
    /** Execute a single step */
    private executeStep;
    /** Execute an action step — find element, then act */
    private executeAction;
    /** Wait for an element to appear (or disappear) */
    private executeWait;
    /** Execute conditional step — check element, branch accordingly */
    private executeConditional;
    /** Type text into an element, optionally clearing first */
    private executeTypeText;
}
/** Create a "fill form" chain from field/value pairs */
export declare function buildFormChain(pid: number, name: string, fields: Array<{
    selector: ElementSelector;
    value: string;
    clearFirst?: boolean;
}>, submitSelector?: ElementSelector): ChainDefinition;
/** Create a "navigate menu" chain (click through menu items) */
export declare function buildMenuChain(pid: number, name: string, menuPath: string[]): ChainDefinition;
