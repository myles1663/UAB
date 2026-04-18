function getFetch() {
    const fetchImpl = globalThis.fetch;
    if (!fetchImpl) {
        throw new Error('global fetch() is unavailable in this Node runtime');
    }
    return fetchImpl.bind(globalThis);
}
function readConfig(app) {
    const directApi = app.connectionInfo?.directApi;
    if (!directApi || typeof directApi !== 'object')
        return null;
    const cfg = directApi;
    if (!cfg.baseUrl || typeof cfg.baseUrl !== 'string')
        return null;
    return cfg;
}
export class DirectApiPlugin {
    framework = 'unknown';
    name = 'Direct API Plugin';
    controlMethod = 'direct-api';
    canHandle(app) {
        return !!readConfig(app);
    }
    async connect(app) {
        const config = readConfig(app);
        if (!config) {
            throw new Error(`No directApi connection info is configured for ${app.name}`);
        }
        return new DirectApiConnection(app, config);
    }
}
class DirectApiConnection {
    app;
    connected = true;
    config;
    fetchImpl;
    constructor(app, config) {
        this.app = app;
        this.config = config;
        this.fetchImpl = getFetch();
    }
    async enumerate() {
        const response = await this.invoke('enumerate', {
            pid: this.app.pid,
            app: this.app,
        });
        return response;
    }
    async query(selector) {
        const response = await this.invoke('query', {
            pid: this.app.pid,
            app: this.app,
            selector,
        });
        return response;
    }
    async act(elementId, action, params) {
        const response = await this.invoke('act', {
            pid: this.app.pid,
            app: this.app,
            elementId,
            action,
            params,
        });
        return response;
    }
    async state() {
        const response = await this.invoke('state', {
            pid: this.app.pid,
            app: this.app,
        });
        return response;
    }
    async subscribe(event, callback) {
        void event;
        void callback;
        const id = `direct-api-nosub-${Date.now()}`;
        return {
            id,
            event,
            unsubscribe: () => undefined,
        };
    }
    async disconnect() {
        return;
    }
    endpointFor(operation) {
        const override = this.config.endpoints?.[operation];
        if (override)
            return override;
        return `/${operation}`;
    }
    async invoke(operation, payload) {
        const base = this.config.baseUrl.replace(/\/+$/, '');
        const endpoint = this.endpointFor(operation).replace(/^\/?/, '/');
        const res = await this.fetchImpl(`${base}${endpoint}`, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                ...(this.config.headers || {}),
            },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Direct API ${operation} failed: ${res.status} ${res.statusText}${text ? ` - ${text}` : ''}`);
        }
        return res.json();
    }
}
//# sourceMappingURL=index.js.map