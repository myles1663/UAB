/**
 * Control Router
 *
 * Selects the best available control method for each app:
 *   Priority 1: Direct API / MCP Server (if available)
 *   Priority 2: Framework-specific UAB hook
 *   Priority 3: WinUIA accessibility fallback
 *   Priority 4: Vision + input injection fallback
 */
import { WinUIAPlugin } from './plugins/win-uia/index.js';
import { VisionPlugin } from './plugins/vision/index.js';
export class ControlRouter {
    pluginManager;
    routes = new Map();
    uiaFallback = new WinUIAPlugin();
    visionFallback = new VisionPlugin();
    constructor(pluginManager) {
        this.pluginManager = pluginManager;
    }
    async connect(app) {
        const methods = this.describeAvailableMethods(app);
        let lastError = null;
        for (const method of methods) {
            try {
                const connection = await this.tryMethod(app, method);
                if (connection) {
                    const route = {
                        app,
                        method,
                        connection,
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
    describeAvailableMethods(app) {
        const methods = [];
        for (const plugin of this.pluginManager.getCandidatePlugins(app)) {
            if (!methods.includes(plugin.controlMethod)) {
                methods.push(plugin.controlMethod);
            }
        }
        if (!methods.includes(this.uiaFallback.controlMethod) && this.uiaFallback.canHandle(app)) {
            methods.push(this.uiaFallback.controlMethod);
        }
        if (!methods.includes(this.visionFallback.controlMethod) && this.visionFallback.canHandle(app)) {
            methods.push(this.visionFallback.controlMethod);
        }
        return methods;
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
                        app: route.app,
                        method,
                        connection,
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
    async tryMethod(app, method) {
        switch (method) {
            case 'direct-api':
            case 'chrome-extension':
            case 'browser-cdp':
            case 'electron-cdp':
            case 'office-com+uia':
            case 'qt-uia':
            case 'gtk-uia':
            case 'java-jab-uia':
            case 'flutter-uia': {
                const plugin = this.pluginManager.findPluginByMethod(app, method);
                if (!plugin) {
                    throw new Error(`Framework hook ${method} is not available for ${app.name}`);
                }
                return plugin.connect(app);
            }
            case 'win-uia':
                if (this.uiaFallback.canHandle(app)) {
                    return this.uiaFallback.connect(app);
                }
                throw new Error('WinUIA fallback not available for this app');
            case 'vision':
                if (this.visionFallback.canHandle(app)) {
                    return this.visionFallback.connect(app);
                }
                throw new Error('Vision fallback requires ANTHROPIC_API_KEY');
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