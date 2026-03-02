#!/usr/bin/env node
/**
 * UAB CLI — Standalone command-line interface for the Universal App Bridge.
 *
 * Designed for Claude to call via the Bash tool:
 *   node dist/uab/cli.js detect
 *   node dist/uab/cli.js detect --electron
 *   node dist/uab/cli.js connect <name|pid>
 *   node dist/uab/cli.js enumerate <pid> [--depth N]
 *   node dist/uab/cli.js query <pid> [--type button] [--label "Submit"]
 *   node dist/uab/cli.js act <pid> <elementId> <action> [--text "hello"] [--value "opt1"]
 *   node dist/uab/cli.js state <pid>
 *
 * All output is JSON for easy parsing by AI agents.
 * This CLI is stateless — each invocation creates fresh connections.
 * For persistent connections, use the UAB service via ClaudeClaw.
 */
export {};
