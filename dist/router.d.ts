/**
 * Control Router
 *
 * Selects the best available control method for each app:
 *   Priority 1: Direct API / MCP Server (if available)
 *   Priority 2: UAB Framework Hook (this project)
 *   Priority 3: Accessibility API (OS-native)
 *   Priority 4: Vision + Input Injection (universal fallback)
 */
import type { DetectedApp, PluginConnection, ControlMethod, ControlRoute, UIElement, ElementSelector, ActionType, ActionParams, ActionResult, AppState, UABEventType, UABEventCallback, Subscription } from './types.js';
import { PluginManager } from './plugins/base.js';
export declare class ControlRouter {
    private pluginManager;
    private routes;
    constructor(pluginManager: PluginManager);
    connect(app: DetectedApp): Promise<RoutedConnection>;
    getRoute(pid: number): ControlRoute | undefined;
    disconnect(pid: number): Promise<void>;
    disconnectAll(): Promise<void>;
    fallback(pid: number): Promise<RoutedConnection | null>;
    private getAvailableMethods;
    private uiaFallback;
    private tryMethod;
}
export declare class RoutedConnection implements PluginConnection {
    private route;
    private router;
    constructor(route: ControlRoute, router: ControlRouter);
    get app(): DetectedApp;
    get connected(): boolean;
    get method(): ControlMethod;
    enumerate(): Promise<UIElement[]>;
    query(selector: ElementSelector): Promise<UIElement[]>;
    act(elementId: string, action: ActionType, params?: ActionParams): Promise<ActionResult>;
    state(): Promise<AppState>;
    subscribe(event: UABEventType, callback: UABEventCallback): Promise<Subscription>;
    disconnect(): Promise<void>;
    private withActionFallback;
    private withFallback;
}
//# sourceMappingURL=router.d.ts.map