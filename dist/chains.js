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
import { createLogger } from './logger.js';
const log = createLogger('uab-chains');
// ─── Chain Executor ────────────────────────────────────────────
export class ChainExecutor {
    uab;
    constructor(uab) {
        this.uab = uab;
    }
    /** Execute a chain definition */
    async execute(chain) {
        const startTime = Date.now();
        const stopOnError = chain.stopOnError ?? true;
        const stepDelay = chain.stepDelay ?? 200;
        const stepResults = [];
        let stepsCompleted = 0;
        log.info('Chain started', { name: chain.name, pid: chain.pid, steps: chain.steps.length });
        for (let i = 0; i < chain.steps.length; i++) {
            const step = chain.steps[i];
            const stepStart = Date.now();
            try {
                const result = await this.executeStep(chain.pid, step);
                stepResults.push({
                    stepIndex: i,
                    step,
                    success: true,
                    result: result || undefined,
                    durationMs: Date.now() - stepStart,
                });
                stepsCompleted++;
            }
            catch (err) {
                const errorMsg = err instanceof Error ? err.message : String(err);
                log.warn('Chain step failed', {
                    name: chain.name,
                    step: i,
                    type: step.type,
                    label: step.label,
                    error: errorMsg,
                });
                stepResults.push({
                    stepIndex: i,
                    step,
                    success: false,
                    error: errorMsg,
                    durationMs: Date.now() - stepStart,
                });
                if (stopOnError) {
                    return {
                        name: chain.name,
                        success: false,
                        stepsCompleted,
                        totalSteps: chain.steps.length,
                        steps: stepResults,
                        durationMs: Date.now() - startTime,
                        error: `Step ${i} (${step.label || step.type}) failed: ${errorMsg}`,
                    };
                }
            }
            // Inter-step delay (skip after last step)
            if (i < chain.steps.length - 1 && stepDelay > 0) {
                await new Promise(r => setTimeout(r, stepDelay));
            }
        }
        const result = {
            name: chain.name,
            success: stepResults.every(s => s.success),
            stepsCompleted,
            totalSteps: chain.steps.length,
            steps: stepResults,
            durationMs: Date.now() - startTime,
        };
        log.info('Chain completed', {
            name: chain.name,
            success: result.success,
            stepsCompleted,
            durationMs: result.durationMs,
        });
        return result;
    }
    /** Execute a single step */
    async executeStep(pid, step) {
        switch (step.type) {
            case 'action':
                return this.executeAction(pid, step);
            case 'wait':
                await this.executeWait(pid, step);
                return null;
            case 'conditional':
                await this.executeConditional(pid, step);
                return null;
            case 'delay':
                await new Promise(r => setTimeout(r, step.ms));
                return null;
            case 'keypress':
                return this.uab.keypress(pid, step.key);
            case 'hotkey':
                return this.uab.hotkey(pid, step.keys);
            case 'typeText':
                return this.executeTypeText(pid, step);
            default:
                throw new Error(`Unknown step type: ${step.type}`);
        }
    }
    /** Execute an action step — find element, then act */
    async executeAction(pid, step) {
        const elements = await this.uab.query(pid, step.selector);
        if (elements.length === 0) {
            throw new Error(`No element found matching selector: ${JSON.stringify(step.selector)}`);
        }
        const target = elements[0];
        return this.uab.act(pid, target.id, step.action, step.params);
    }
    /** Wait for an element to appear (or disappear) */
    async executeWait(pid, step) {
        const timeout = step.timeoutMs ?? 10_000;
        const poll = step.pollMs ?? 500;
        const deadline = Date.now() + timeout;
        while (Date.now() < deadline) {
            const elements = await this.uab.query(pid, step.selector);
            const found = elements.length > 0;
            if (step.waitForAbsence ? !found : found) {
                return; // Condition met
            }
            await new Promise(r => setTimeout(r, poll));
        }
        const condition = step.waitForAbsence ? 'disappear' : 'appear';
        throw new Error(`Timeout waiting for element to ${condition}: ${JSON.stringify(step.selector)} (${timeout}ms)`);
    }
    /** Execute conditional step — check element, branch accordingly */
    async executeConditional(pid, step) {
        const elements = await this.uab.query(pid, step.selector);
        const present = elements.length > 0;
        const branch = present ? step.ifPresent : (step.ifAbsent || []);
        for (const subStep of branch) {
            await this.executeStep(pid, subStep);
        }
    }
    /** Type text into an element, optionally clearing first */
    async executeTypeText(pid, step) {
        const elements = await this.uab.query(pid, step.selector);
        if (elements.length === 0) {
            throw new Error(`No element found for typing: ${JSON.stringify(step.selector)}`);
        }
        const target = elements[0];
        if (step.clearFirst) {
            await this.uab.act(pid, target.id, 'clear');
            await new Promise(r => setTimeout(r, 100));
        }
        return this.uab.act(pid, target.id, 'type', { text: step.text });
    }
}
// ─── Pre-built Chain Templates ─────────────────────────────────
/** Create a "fill form" chain from field/value pairs */
export function buildFormChain(pid, name, fields, submitSelector) {
    const steps = fields.map(f => ({
        type: 'typeText',
        selector: f.selector,
        text: f.value,
        clearFirst: f.clearFirst ?? true,
        label: `Fill "${f.selector.label || f.selector.type || 'field'}"`,
    }));
    if (submitSelector) {
        steps.push({
            type: 'action',
            selector: submitSelector,
            action: 'click',
            label: 'Submit form',
        });
    }
    return { name, pid, steps };
}
/** Create a "navigate menu" chain (click through menu items) */
export function buildMenuChain(pid, name, menuPath) {
    const steps = menuPath.map((label, i) => ({
        type: 'action',
        selector: { type: i === 0 ? 'menu' : 'menuitem', label },
        action: 'click',
        label: `Click "${label}"`,
    }));
    return { name, pid, steps, stepDelay: 300 };
}
//# sourceMappingURL=chains.js.map