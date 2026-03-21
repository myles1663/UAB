#!/usr/bin/env node
/**
 * UAB CLI — Framework-independent command-line interface for the Universal App Bridge.
 *
 * Works with ANY AI agent framework:
 *   - Claude Code (Bash tool)
 *   - Codex CLI (shell commands)
 *   - Custom agents (subprocess)
 *   - MD-only agents (parse JSON output)
 *
 * New commands (connector layer):
 *   node dist/uab/cli.js scan              — Detect apps + save to registry
 *   node dist/uab/cli.js apps              — List known apps from registry (instant)
 *   node dist/uab/cli.js find <name>       — Search registry, fallback to live detect
 *   node dist/uab/cli.js profiles          — Show registry file info
 *
 * Classic commands (all still work):
 *   node dist/uab/cli.js detect            — Scan for apps (alias for scan)
 *   node dist/uab/cli.js connect <name|pid>
 *   node dist/uab/cli.js enumerate <pid> [--depth N]
 *   node dist/uab/cli.js query <pid> [--type button] [--label "Submit"]
 *   node dist/uab/cli.js act <pid> <elementId> <action> [--text "hello"]
 *   node dist/uab/cli.js state <pid>
 *
 * All output is JSON for easy parsing by AI agents.
 * Profiles persist to data/uab-profiles/registry.json for cross-session knowledge.
 */
export {};
//# sourceMappingURL=cli.d.ts.map