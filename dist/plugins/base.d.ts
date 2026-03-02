/**
 * Base Plugin & Plugin Manager
 *
 * Manages framework plugin registration and routing.
 * Supports multiple plugins and selects the best one via canHandle().
 */
import type { DetectedApp, FrameworkPlugin, FrameworkType, PluginConnection } from '../types.js';
export declare class PluginManager {
    private plugins;
    private connections;
    /**
     * Register a framework plugin. Plugins are tried in registration order,
     * so register specific plugins before generic fallbacks.
     */
    register(plugin: FrameworkPlugin): void;
    /**
     * Get all registered framework types (unique).
     */
    getRegisteredFrameworks(): FrameworkType[];
    /**
     * Check if any plugin can handle the given framework.
     */
    hasPlugin(framework: FrameworkType): boolean;
    /**
     * Find the best plugin for an app by trying each in order.
     */
    findPlugin(app: DetectedApp): FrameworkPlugin | null;
    /**
     * Connect to an app using the best available plugin.
     */
    connect(app: DetectedApp): Promise<PluginConnection>;
    getConnection(pid: number): PluginConnection | undefined;
    disconnect(pid: number): Promise<void>;
    disconnectAll(): Promise<void>;
    getActiveConnections(): Array<{
        pid: number;
        app: DetectedApp;
        connected: boolean;
    }>;
}
