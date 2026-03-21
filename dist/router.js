/**
 * Control Router
 *
 * Selects the best available control method for each app:
 *   Priority 1: Direct API / MCP Server (if available)
 *   Priority 2: UAB Framework Hook (this project)
 *   Priority 3: Accessibility API (OS-native)
 *   Priority 4: Vision + Input Injection (universal fallback)
 */
import { WinUIAPlugin } from './plugins/win-uia/index.js';
import { VisionPlugin } from './plugins/vision/index.js';
export class ControlRouter {
    pluginManager;
    routes = new Map();
    constructor(pluginManager) {
        this.pluginManager = pluginManager;
    }
    async connect(app) {
        const methods = this.getAvailableMethods(app);
        let lastError = null;
        for (const method of methods) {
            try {
                const connection = await this.tryMethod(app, method);
                if (connection) {
                    const route = {
                        app, method, connection,
                        fallbacks: methods.filter(m => m !== method),
                    };
                    this.routes.set(app.pid, route);
                    return new RoutedConnection(route, this);
                }
            }
            catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err));
            }
        }
        throw new Error(`Cannot connect to ${app.name} (PID: ${app.pid}). ` +
            `Tried methods: ${methods.join(', ')}. ` +
            `Last error: ${lastError?.message || 'unknown'}`);
    }
    getRoute(pid) {
        return this.routes.get(pid);
    }
    async disconnect(pid) {
        const route = this.routes.get(pid);
        if (route) {
            await route.connection.disconnect();
            this.routes.delete(pid);
        }
    }
    async disconnectAll() {
        for (const [pid] of this.routes) {
            await this.disconnect(pid);
        }
    }
    async fallback(pid) {
        const route = this.routes.get(pid);
        if (!route || route.fallbacks.length === 0)
            return null;
        try {
            await route.connection.disconnect();
        }
        catch { /* best effort */ }
        for (const method of route.fallbacks) {
            try {
                const connection = await this.tryMethod(route.app, method);
                if (connection) {
                    const newRoute = {
                        app: route.app, method, connection,
                        fallbacks: route.fallbacks.filter(m => m !== method),
                    };
                    this.routes.set(pid, newRoute);
                    return new RoutedConnection(newRoute, this);
                }
            }
            catch { /* continue */ }
        }
        this.routes.delete(pid);
        return null;
    }
    getAvailableMethods(app) {
        const methods = [];
        if (this.pluginManager.hasPlugin(app.framework)) {
            methods.push('uab-hook');
        }
        methods.push('accessibility');
        // Vision is always last — expensive but universal
        if (this.visionFallback.canHandle(app)) {
            methods.push('vision');
        }
        return methods;
    }
    uiaFallback = new WinUIAPlugin();
    visionFallback = new VisionPlugin();
    async tryMethod(app, method) {
        switch (method) {
            case 'uab-hook':
                return this.pluginManager.connect(app);
            case 'accessibility':
                // Use Windows UI Automation as the accessibility fallback
                if (this.uiaFallback.canHandle(app)) {
                    return this.uiaFallback.connect(app);
                }
                throw new Error('Accessibility API fallback not available for this app');
            case 'vision':
                // Vision fallback — screenshot + Claude Vision API + coordinate input
                if (this.visionFallback.canHandle(app)) {
                    return this.visionFallback.connect(app);
                }
                throw new Error('Vision fallback requires ANTHROPIC_API_KEY');
            case 'direct-api':
                throw new Error('Direct API method not yet implemented');
            default:
                throw new Error(`Unknown control method: ${method}`);
        }
    }
}
export class RoutedConnection {
    route;
    router;
    constructor(route, router) {
        this.route = route;
        this.router = router;
    }
    get app() { return this.route.app; }
    get connected() { return this.route.connection.connected; }
    get method() { return this.route.method; }
    async enumerate() {
        return this.withFallback(() => this.route.connection.enumerate());
    }
    async query(selector) {
        return this.withFallback(() => this.route.connection.query(selector));
    }
    async act(elementId, action, params) {
        return this.withActionFallback(elementId, action, params);
    }
    async state() {
        return this.withFallback(() => this.route.connection.state());
    }
    async subscribe(event, callback) {
        return this.route.connection.subscribe(event, callback);
    }
    async disconnect() {
        return this.router.disconnect(this.route.app.pid);
    }
    async withActionFallback(elementId, action, params) {
        try {
            const result = await this.route.connection.act(elementId, action, params);
            // If the action failed and there are fallbacks, try the next method
            if (!result.success && result.error && this.route.fallbacks.length > 0) {
                const fallbackConn = await this.router.fallback(this.route.app.pid);
                if (fallbackConn) {
                    const newRoute = this.router.getRoute(this.route.app.pid);
                    if (newRoute)
                        this.route = newRoute;
                    return this.route.connection.act(elementId, action, params);
                }
            }
            return result;
        }
        catch (err) {
            const fallbackConn = await this.router.fallback(this.route.app.pid);
            if (fallbackConn) {
                const newRoute = this.router.getRoute(this.route.app.pid);
                if (newRoute)
                    this.route = newRoute;
                return this.route.connection.act(elementId, action, params);
            }
            throw err;
        }
    }
    async withFallback(op) {
        try {
            return await op();
        }
        catch (err) {
            const fallbackConn = await this.router.fallback(this.route.app.pid);
            if (fallbackConn) {
                const newRoute = this.router.getRoute(this.route.app.pid);
                if (newRoute)
                    this.route = newRoute;
                return op();
            }
            throw err;
        }
    }
}
//# sourceMappingURL=router.js.map