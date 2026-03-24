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
import { UABConnector } from './connector.js';
import * as readline from 'readline';
// ─── Tool Definitions ──────────────────────────────────────────
const TOOLS = [
    {
        name: 'desktop_scan',
        description: 'Scan for all running desktop applications. Returns app names, PIDs, and detected frameworks. Use this first to discover what apps are available.',
        inputSchema: {
            type: 'object',
            properties: {},
        },
    },
    {
        name: 'desktop_apps',
        description: 'List previously discovered apps from the registry (instant, no scanning). Use after desktop_scan.',
        inputSchema: {
            type: 'object',
            properties: {
                framework: { type: 'string', description: 'Filter by framework (electron, qt, gtk, uwp, win32, etc.)' },
            },
        },
    },
    {
        name: 'desktop_connect',
        description: 'Connect to a desktop application by name or PID. Required before interacting with an app.',
        inputSchema: {
            type: 'object',
            properties: {
                target: { type: ['string', 'number'], description: 'App name (fuzzy match) or PID number' },
            },
            required: ['target'],
        },
    },
    {
        name: 'desktop_ui_tree',
        description: 'Get the structured UI element tree of a connected app. Returns buttons, text fields, menus, etc. with their IDs, types, labels, and bounding rectangles. MUCH faster and more reliable than taking a screenshot — use this instead.',
        inputSchema: {
            type: 'object',
            properties: {
                pid: { type: 'number', description: 'Process ID of the connected app' },
                maxDepth: { type: 'number', description: 'Max tree depth (default: 8)' },
            },
            required: ['pid'],
        },
    },
    {
        name: 'desktop_find_elements',
        description: 'Find specific UI elements by type, label, or properties. Returns matching elements with their IDs for use with desktop_act. More targeted than desktop_ui_tree.',
        inputSchema: {
            type: 'object',
            properties: {
                pid: { type: 'number', description: 'Process ID' },
                type: { type: 'string', description: 'Element type: button, textfield, menu, menuitem, checkbox, tab, etc.' },
                label: { type: 'string', description: 'Text label to search for (substring match)' },
                labelExact: { type: 'string', description: 'Exact label match' },
                visible: { type: 'boolean', description: 'Only visible elements (default: true)' },
                enabled: { type: 'boolean', description: 'Only enabled elements' },
                limit: { type: 'number', description: 'Max results (default: 50)' },
            },
            required: ['pid'],
        },
    },
    {
        name: 'desktop_act',
        description: 'Perform an action on a UI element. Actions: click, doubleclick, type, clear, select, check, uncheck, toggle, expand, collapse, invoke, scroll, focus. Use element IDs from desktop_find_elements or desktop_ui_tree.',
        inputSchema: {
            type: 'object',
            properties: {
                pid: { type: 'number', description: 'Process ID' },
                elementId: { type: 'string', description: 'Element ID from enumerate/query results' },
                action: { type: 'string', description: 'Action: click, doubleclick, type, clear, select, check, uncheck, toggle, expand, collapse, invoke, scroll, focus, hover' },
                text: { type: 'string', description: 'Text to type (for "type" action)' },
                value: { type: 'string', description: 'Value to set (for "select" action)' },
            },
            required: ['pid', 'elementId', 'action'],
        },
    },
    {
        name: 'desktop_spatial_map',
        description: 'Get a spatial layout of the UI — elements organized into rows and columns with positions. This gives you a human-readable understanding of the UI layout WITHOUT needing a screenshot. Much faster and more structured than vision-based approaches.',
        inputSchema: {
            type: 'object',
            properties: {
                pid: { type: 'number', description: 'Process ID' },
                format: { type: 'string', enum: ['detailed', 'compact', 'json'], description: 'Output format (default: compact)' },
                maxDepth: { type: 'number', description: 'Max tree depth (default: 6)' },
            },
            required: ['pid'],
        },
    },
    {
        name: 'desktop_state',
        description: 'Get current app state: window position/size, focused element, active modals, title.',
        inputSchema: {
            type: 'object',
            properties: {
                pid: { type: 'number', description: 'Process ID' },
            },
            required: ['pid'],
        },
    },
    {
        name: 'desktop_keypress',
        description: 'Send a keyboard key to an app. Keys: enter, tab, escape, space, backspace, delete, up, down, left, right, home, end, f1-f12, etc.',
        inputSchema: {
            type: 'object',
            properties: {
                pid: { type: 'number', description: 'Process ID' },
                key: { type: 'string', description: 'Key name (e.g., "enter", "tab", "escape", "f5")' },
            },
            required: ['pid', 'key'],
        },
    },
    {
        name: 'desktop_hotkey',
        description: 'Send a keyboard shortcut to an app. Examples: "ctrl+s" (save), "ctrl+c" (copy), "alt+f4" (close), "ctrl+shift+p" (command palette).',
        inputSchema: {
            type: 'object',
            properties: {
                pid: { type: 'number', description: 'Process ID' },
                keys: { type: 'string', description: 'Key combination (e.g., "ctrl+s", "ctrl+shift+p", "alt+f4")' },
            },
            required: ['pid', 'keys'],
        },
    },
    {
        name: 'desktop_window',
        description: 'Control app window: minimize, maximize, restore, close, move, or resize.',
        inputSchema: {
            type: 'object',
            properties: {
                pid: { type: 'number', description: 'Process ID' },
                action: { type: 'string', enum: ['minimize', 'maximize', 'restore', 'close', 'move', 'resize'], description: 'Window action' },
                x: { type: 'number', description: 'X position (for move/resize)' },
                y: { type: 'number', description: 'Y position (for move/resize)' },
                width: { type: 'number', description: 'Width (for resize)' },
                height: { type: 'number', description: 'Height (for resize)' },
            },
            required: ['pid', 'action'],
        },
    },
    {
        name: 'desktop_smart_click',
        description: 'Click an element by name using intelligent 6-method fallback. Tries: InvokePattern → Focus+Enter → Parent invoke → Click coordinates → Expand → Toggle. Use when you know the element name but not its ID.',
        inputSchema: {
            type: 'object',
            properties: {
                pid: { type: 'number', description: 'Process ID' },
                name: { type: 'string', description: 'Element name/label to click' },
            },
            required: ['pid', 'name'],
        },
    },
    {
        name: 'desktop_chain',
        description: 'Execute a multi-step action sequence atomically (all steps in one PowerShell session, no focus stealing between steps). Steps: hotkey, keypress, click, type, wait.',
        inputSchema: {
            type: 'object',
            properties: {
                pid: { type: 'number', description: 'Process ID' },
                steps: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            action: { type: 'string', enum: ['hotkey', 'keypress', 'click', 'type', 'wait'] },
                            keys: { type: 'string', description: 'For hotkey: "ctrl+s"' },
                            key: { type: 'string', description: 'For keypress: "enter"' },
                            name: { type: 'string', description: 'For click: element name' },
                            text: { type: 'string', description: 'For type: text to enter' },
                            ms: { type: 'number', description: 'For wait: milliseconds' },
                        },
                        required: ['action'],
                    },
                    description: 'Steps to execute in sequence',
                },
            },
            required: ['pid', 'steps'],
        },
    },
    {
        name: 'desktop_focused',
        description: 'Get the currently focused UI element in an app. Fast (<50ms) — useful for tracking where the cursor/focus is.',
        inputSchema: {
            type: 'object',
            properties: {
                pid: { type: 'number', description: 'Process ID' },
            },
            required: ['pid'],
        },
    },
    {
        name: 'desktop_screenshot',
        description: 'Take a screenshot of an app window. Returns base64 PNG. NOTE: Prefer desktop_spatial_map or desktop_ui_tree for understanding UI layout — screenshots should be a last resort for visual-only content like images or charts.',
        inputSchema: {
            type: 'object',
            properties: {
                pid: { type: 'number', description: 'Process ID' },
            },
            required: ['pid'],
        },
    },
];
// ─── Server Implementation ─────────────────────────────────────
class UABMCPServer {
    connector;
    started = false;
    constructor() {
        this.connector = new UABConnector({ persistent: false });
    }
    async handleRequest(msg) {
        if (!msg.method)
            return null;
        try {
            switch (msg.method) {
                case 'initialize':
                    return this.respond(msg.id, {
                        protocolVersion: '2024-11-05',
                        capabilities: { tools: {} },
                        serverInfo: {
                            name: 'uab-desktop-control',
                            version: '1.0.0',
                        },
                    });
                case 'notifications/initialized':
                    // Start connector on initialized notification
                    if (!this.started) {
                        await this.connector.start();
                        this.started = true;
                    }
                    return null; // notifications don't get responses
                case 'tools/list':
                    return this.respond(msg.id, { tools: TOOLS });
                case 'tools/call':
                    return this.respond(msg.id, await this.callTool(msg.params));
                case 'ping':
                    return this.respond(msg.id, {});
                default:
                    return this.respondError(msg.id, -32601, `Method not found: ${msg.method}`);
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return this.respondError(msg.id, -32603, message);
        }
    }
    async callTool(params) {
        const { name, arguments: args = {} } = params;
        // Ensure connector is started
        if (!this.started) {
            await this.connector.start();
            this.started = true;
        }
        try {
            let result;
            switch (name) {
                case 'desktop_scan':
                    result = await this.connector.scan();
                    break;
                case 'desktop_apps': {
                    const all = this.connector.apps();
                    if (args.framework) {
                        result = all.filter((a) => a.framework === args.framework);
                    }
                    else {
                        result = all;
                    }
                    break;
                }
                case 'desktop_connect': {
                    if (typeof args.target === 'number') {
                        result = await this.connector.connect(args.target);
                    }
                    else {
                        result = await this.connector.connect(String(args.target));
                    }
                    break;
                }
                case 'desktop_ui_tree':
                    result = await this.connector.enumerate(args.pid, args.maxDepth);
                    // Flatten for readability
                    result = this.connector.flattenTree(result, args.maxDepth || 8);
                    break;
                case 'desktop_find_elements': {
                    const selector = {};
                    if (args.type)
                        selector.type = args.type;
                    if (args.label)
                        selector.label = args.label;
                    if (args.labelExact)
                        selector.labelExact = args.labelExact;
                    if (args.visible !== undefined)
                        selector.visible = args.visible;
                    if (args.enabled !== undefined)
                        selector.enabled = args.enabled;
                    if (args.limit)
                        selector.limit = args.limit;
                    result = await this.connector.query(args.pid, selector);
                    break;
                }
                case 'desktop_act': {
                    const actParams = {};
                    if (args.text)
                        actParams.text = args.text;
                    if (args.value)
                        actParams.value = args.value;
                    result = await this.connector.act(args.pid, args.elementId, args.action, Object.keys(actParams).length > 0 ? actParams : undefined);
                    break;
                }
                case 'desktop_spatial_map':
                    result = await this.connector.textMap(args.pid, (args.format || 'compact'));
                    break;
                case 'desktop_state':
                    result = await this.connector.state(args.pid);
                    break;
                case 'desktop_keypress':
                    result = await this.connector.keypress(args.pid, args.key);
                    break;
                case 'desktop_hotkey':
                    result = await this.connector.hotkey(args.pid, args.keys);
                    break;
                case 'desktop_window': {
                    const winParams = {};
                    if (args.x !== undefined)
                        winParams.x = args.x;
                    if (args.y !== undefined)
                        winParams.y = args.y;
                    if (args.width !== undefined)
                        winParams.width = args.width;
                    if (args.height !== undefined)
                        winParams.height = args.height;
                    result = await this.connector.window(args.pid, args.action, Object.keys(winParams).length > 0 ? winParams : undefined);
                    break;
                }
                case 'desktop_smart_click':
                    result = await this.connector.smartInvoke(args.pid, args.name);
                    break;
                case 'desktop_chain':
                    result = await this.connector.atomicChain({
                        pid: args.pid,
                        steps: args.steps,
                    });
                    break;
                case 'desktop_focused':
                    result = await this.connector.focused(args.pid);
                    break;
                case 'desktop_screenshot': {
                    const screenshotResult = await this.connector.screenshot(args.pid);
                    // Return base64 image info
                    const ssStr = String(screenshotResult);
                    return {
                        content: [{
                                type: 'text',
                                text: `Screenshot captured (base64 PNG, ${ssStr.length} chars). Use desktop_spatial_map instead for UI understanding.`,
                            }],
                    };
                }
                default:
                    return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
            }
            return {
                content: [{
                        type: 'text',
                        text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
                    }],
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
        }
    }
    respond(id, result) {
        return { jsonrpc: '2.0', id, result };
    }
    respondError(id, code, message) {
        return { jsonrpc: '2.0', id, error: { code, message } };
    }
    async shutdown() {
        if (this.started) {
            await this.connector.stop();
            this.started = false;
        }
    }
}
// ─── Main: stdio transport ─────────────────────────────────────
async function main() {
    const server = new UABMCPServer();
    const rl = readline.createInterface({
        input: process.stdin,
        terminal: false,
    });
    // Read newline-delimited JSON-RPC messages from stdin
    rl.on('line', async (line) => {
        const trimmed = line.trim();
        if (!trimmed)
            return;
        try {
            const msg = JSON.parse(trimmed);
            const response = await server.handleRequest(msg);
            if (response) {
                process.stdout.write(JSON.stringify(response) + '\n');
            }
        }
        catch {
            const error = {
                jsonrpc: '2.0',
                id: null,
                error: { code: -32700, message: 'Parse error' },
            };
            process.stdout.write(JSON.stringify(error) + '\n');
        }
    });
    // Graceful shutdown
    process.on('SIGINT', async () => {
        await server.shutdown();
        process.exit(0);
    });
    process.on('SIGTERM', async () => {
        await server.shutdown();
        process.exit(0);
    });
    rl.on('close', async () => {
        await server.shutdown();
        process.exit(0);
    });
}
main().catch((err) => {
    process.stderr.write(`UAB MCP Server fatal error: ${err}\n`);
    process.exit(1);
});
//# sourceMappingURL=mcp-server.js.map