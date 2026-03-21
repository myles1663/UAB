/**
 * Skills Directory Detection — Claude Code CLI + Co-work
 *
 * Installs the UAB skill into BOTH plugin systems:
 *
 * 1. Claude Code CLI: ~/.claude/plugins/marketplaces/claude-plugins-official/plugins/uab-bridge/
 * 2. Co-work: %APPDATA%/Claude/local-agent-mode-sessions/{session}/{workspace}/cowork_plugins/
 *    marketplaces/knowledge-work-plugins/uab-desktop-control/
 *
 * Both use the same SKILL.md format with frontmatter.
 */
export interface SkillsDirResult {
    path: string;
    method: 'env' | 'known-path' | 'config-search' | 'created';
    exists: boolean;
    created: boolean;
    /** Full path to the SKILL.md file (CLI) */
    skillFilePath: string;
    /** Path to the plugin root (contains skills/ dir) */
    pluginRoot: string;
    /** Co-work skill paths (may be multiple sessions) */
    coworkPaths: string[];
}
/**
 * Find or create the UAB plugin directories for BOTH Claude Code CLI and Co-work.
 */
export declare function findCoworkSkillsDir(): Promise<SkillsDirResult>;
/**
 * Write the skill file to ALL detected locations (CLI + Co-work).
 */
export declare function writeSkillToAllLocations(cliSkillPath: string, coworkPaths: string[], content: string): {
    cli: boolean;
    cowork: number;
};
/**
 * Register UAB as an enabled plugin in Claude Code CLI settings.
 */
export declare function registerPlugin(): Promise<{
    success: boolean;
    message: string;
}>;
/**
 * Unregister UAB plugin from Claude Code settings.
 */
export declare function unregisterPlugin(): Promise<{
    success: boolean;
    message: string;
}>;
//# sourceMappingURL=skills-dir.d.ts.map