/**
 * Agent Prompt Templates — Drop-in system instructions that teach ANY AI agent
 * to prefer UAB's structured APIs over screenshots.
 *
 * The key insight: agents default to screenshots because their training data
 * shows that approach. We override that instinct at the prompt level.
 *
 * @example
 * ```ts
 * import { getAgentPrompt } from './agent-prompt.js';
 *
 * // For Claude Code / MCP agents
 * const prompt = getAgentPrompt('mcp');
 *
 * // For CLI-based agents (Codex, custom)
 * const prompt = getAgentPrompt('cli');
 *
 * // For HTTP API agents
 * const prompt = getAgentPrompt('http', { port: 3100 });
 * ```
 */
export interface PromptOptions {
    /** HTTP server port (for 'http' mode). Default: 3100 */
    port?: number;
    /** Path to CLI entry point. Default: 'node dist/uab/cli.js' */
    cliPath?: string;
    /** Include the full tool reference. Default: true */
    includeReference?: boolean;
    /** Include examples. Default: true */
    includeExamples?: boolean;
}
export type PromptMode = 'mcp' | 'cli' | 'http' | 'core';
/**
 * Get a system prompt that teaches an AI agent to use UAB instead of screenshots.
 *
 * @param mode - Integration mode: 'mcp' (tools), 'cli' (bash), 'http' (REST API), 'core' (philosophy only)
 * @param options - Customization options
 * @returns System prompt string to prepend to agent instructions
 */
export declare function getAgentPrompt(mode?: PromptMode, options?: PromptOptions): string;
/**
 * Get a CLAUDE.md-compatible snippet for any project that wants desktop control.
 * Drop this into a CLAUDE.md file and agents will automatically prefer UAB.
 */
export declare function getClaudeMdSnippet(cliPath?: string): string;
/**
 * Get an MCP server configuration snippet for claude_desktop_config.json
 */
export declare function getMcpConfig(serverPath?: string): object;
//# sourceMappingURL=agent-prompt.d.ts.map