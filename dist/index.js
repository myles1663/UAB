/**
 * Universal App Bridge (UAB) — Framework-level desktop app control for AI agents.
 *
 * Hook into UI frameworks (Electron, Qt, GTK, WPF, Flutter, Java, Office)
 * to get structured, reliable access to any desktop application's interface.
 *
 * @example
 * ```ts
 * import { uab } from 'universal-app-bridge';
 *
 * await uab.start();
 * const apps = await uab.detect();
 * await uab.connect(apps[0]);
 * const buttons = await uab.query(apps[0].pid, { type: 'button' });
 * await uab.act(apps[0].pid, buttons[0].id, 'click');
 * await uab.stop();
 * ```
 *
 * @packageDocumentation
 */
// ─── Framework-Independent Connector ─────────────────────────────
export { UABConnector } from './connector.js';
// ─── App Registry ────────────────────────────────────────────────
export { AppRegistry } from './registry.js';
// ─── Core Service (Kai integration) ──────────────────────────────
export { UABService, uab } from './service.js';
export { FRAMEWORK_HOOKS, describeControlMethod } from './hooks.js';
export { getConcertoMethodInventory, planOperation } from './concerto.js';
// ─── Detection & Routing ────────────────────────────────────────
export { FrameworkDetector } from './detector.js';
export { ControlRouter, RoutedConnection } from './router.js';
// ─── Production Hardening ───────────────────────────────────────
export { ElementCache } from './cache.js';
export { ConnectionManager } from './connection-manager.js';
export { PermissionManager } from './permissions.js';
export { withRetry, isRetryable, retryable, withTimeout } from './retry.js';
// ─── Spatial Map & Composite Engine ─────────────────────────────
export { buildSpatialMap, SpatialIndex, renderTextMap, renderJsonMap } from './spatial.js';
export { CompositeEngine } from './composite.js';
// ─── Action Chains ──────────────────────────────────────────────
export { ChainExecutor, buildFormChain, buildMenuChain } from './chains.js';
// ─── Plugins ────────────────────────────────────────────────────
export { PluginManager } from './plugins/base.js';
export { ElectronPlugin } from './plugins/electron/index.js';
export { WinUIAPlugin } from './plugins/win-uia/index.js';
export { QtPlugin } from './plugins/qt/index.js';
export { GtkPlugin } from './plugins/gtk/index.js';
export { JavaPlugin } from './plugins/java/index.js';
export { FlutterPlugin } from './plugins/flutter/index.js';
export { OfficePlugin } from './plugins/office/index.js';
export { DirectApiPlugin } from './plugins/direct-api/index.js';
// ─── Environment Detection ──────────────────────────────────────
export { detectEnvironment, getDefaults, resetEnvironment, env } from './environment.js';
// ─── HTTP Server (Server-Side Access) ───────────────────────────
export { UABServer } from './server.js';
// ─── Agent SDK ─────────────────────────────────────────────────
export { AgentSDK, desktop } from './sdk.js';
// ─── Agent Prompt Templates ────────────────────────────────────
export { getAgentPrompt, getClaudeMdSnippet, getMcpConfig } from './agent-prompt.js';
// ─── Logger ─────────────────────────────────────────────────────
export { createLogger, closeLogger } from './logger.js';
//# sourceMappingURL=index.js.map