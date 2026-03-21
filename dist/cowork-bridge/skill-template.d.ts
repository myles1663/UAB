/**
 * Skill Template Generator
 *
 * Generates the SKILL.md file in Claude Code's plugin skill format.
 *
 * Two modes:
 * 1. Direct HTTP — for Claude Code CLI (runs on host, can reach localhost)
 * 2. Extension relay — for Co-work (runs in VM, talks through Chrome extension)
 *
 * The template includes both methods. Claude picks the one that works
 * from its current context.
 */
export interface SkillTemplateOptions {
    /** Host IP that VMs can reach (e.g., 172.26.224.1) */
    hostIp: string;
    /** API key for authenticated requests */
    apiKey: string;
    /** Chrome extension ID (for runtime.sendMessage) */
    extensionId?: string;
}
export declare function generateSkillContent(options: SkillTemplateOptions): string;
//# sourceMappingURL=skill-template.d.ts.map