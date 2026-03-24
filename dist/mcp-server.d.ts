/**
 * UAB MCP Server — Exposes UAB as Model Context Protocol tools.
 *
 * When an AI agent connects via MCP, it discovers UAB tools natively —
 * no need to "decide" to use UAB over screenshots. The tools are just there.
 *
 * Implements MCP JSON-RPC over stdio (no external dependencies).
 *
 * @example
 * ```bash
 * # Add to claude_desktop_config.json or any MCP-compatible agent:
 * {
 *   "mcpServers": {
 *     "desktop-control": {
 *       "command": "node",
 *       "args": ["dist/uab/mcp-server.js"]
 *     }
 *   }
 * }
 * ```
 */
export {};
//# sourceMappingURL=mcp-server.d.ts.map