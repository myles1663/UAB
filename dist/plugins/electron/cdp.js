/**
 * Chrome DevTools Protocol (CDP) Connection Manager
 *
 * Handles discovery, connection, and communication with Electron apps
 * via the Chrome DevTools Protocol.
 */
import WebSocket from 'ws';
import { execSync } from 'child_process';
import http from 'http';
export class CDPConnection {
    host;
    port;
    ws = null;
    requestId = 0;
    pending = new Map();
    eventHandlers = new Map();
    _connected = false;
    constructor(host = '127.0.0.1', port = 9222) {
        this.host = host;
        this.port = port;
    }
    get connected() {
        return this._connected && this.ws?.readyState === WebSocket.OPEN;
    }
    static async discoverTargets(host = '127.0.0.1', port = 9222) {
        return new Promise((resolve, reject) => {
            const req = http.get(`http://${host}:${port}/json`, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    }
                    catch (e) {
                        reject(new Error(`Failed to parse CDP target list: ${e}`));
                    }
                });
            });
            req.on('error', (e) => reject(new Error(`Cannot reach CDP at ${host}:${port}: ${e.message}`)));
            req.setTimeout(3000, () => { req.destroy(); reject(new Error('CDP discovery timed out')); });
        });
    }
    static findDebugPort(pid) {
        try {
            const cmd = `wmic process where "ProcessId=${pid}" get CommandLine /format:value`;
            const output = execSync(cmd, { encoding: 'utf-8', timeout: 5000 });
            const match = output.match(/--remote-debugging-port=(\d+)/);
            if (match)
                return parseInt(match[1], 10);
        }
        catch { /* no command line access */ }
        const commonPorts = [9222, 9229, 5858, 9223, 9224, 9225];
        for (const port of commonPorts) {
            try {
                const result = execSync(`powershell -NoProfile -Command "(Test-NetConnection -ComputerName 127.0.0.1 -Port ${port} -WarningAction SilentlyContinue).TcpTestSucceeded"`, { encoding: 'utf-8', timeout: 3000 });
                if (result.trim() === 'True') {
                    try {
                        execSync(`powershell -NoProfile -Command "Invoke-WebRequest -Uri 'http://127.0.0.1:${port}/json/version' -UseBasicParsing -TimeoutSec 2"`, {
                            encoding: 'utf-8',
                            timeout: 5000,
                        });
                        return port;
                    }
                    catch { /* not CDP */ }
                }
            }
            catch { /* port not open */ }
        }
        return null;
    }
    static getEnableCommand(appPath, port = 9222) {
        return `set ELECTRON_ENABLE_REMOTE_DEBUGGING=1 && "${appPath}" --remote-debugging-port=${port}`;
    }
    async connect(wsUrl) {
        if (this.connected)
            return;
        if (!wsUrl) {
            const targets = await CDPConnection.discoverTargets(this.host, this.port);
            const pageTarget = targets.find(t => t.type === 'page') || targets[0];
            if (!pageTarget)
                throw new Error('No CDP targets found');
            wsUrl = pageTarget.webSocketDebuggerUrl;
        }
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(wsUrl, { perMessageDeflate: false });
            this.ws.on('open', () => {
                this._connected = true;
                resolve();
            });
            this.ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    if (msg.id !== undefined) {
                        const pending = this.pending.get(msg.id);
                        if (pending) {
                            this.pending.delete(msg.id);
                            if (msg.error) {
                                pending.reject(new Error(`CDP error: ${msg.error.message} (${msg.error.code})`));
                            }
                            else {
                                pending.resolve(msg.result || {});
                            }
                        }
                    }
                    else if (msg.method) {
                        const handlers = this.eventHandlers.get(msg.method);
                        if (handlers) {
                            for (const handler of handlers) {
                                try {
                                    handler(msg.params || {});
                                }
                                catch { /* handler error */ }
                            }
                        }
                    }
                }
                catch { /* parse error */ }
            });
            this.ws.on('close', () => {
                this._connected = false;
                for (const [, pending] of this.pending) {
                    pending.reject(new Error('CDP connection closed'));
                }
                this.pending.clear();
            });
            this.ws.on('error', (err) => {
                if (!this._connected)
                    reject(err);
            });
        });
    }
    async send(method, params) {
        if (!this.connected)
            throw new Error('CDP not connected');
        const id = ++this.requestId;
        const msg = JSON.stringify({ id, method, params: params || {} });
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error(`CDP command timed out: ${method}`));
            }, 30000);
            this.pending.set(id, {
                resolve: (result) => { clearTimeout(timeout); resolve(result); },
                reject: (err) => { clearTimeout(timeout); reject(err); },
            });
            this.ws.send(msg);
        });
    }
    on(method, handler) {
        if (!this.eventHandlers.has(method)) {
            this.eventHandlers.set(method, new Set());
        }
        this.eventHandlers.get(method).add(handler);
    }
    off(method, handler) {
        this.eventHandlers.get(method)?.delete(handler);
    }
    async evaluate(expression) {
        const result = await this.send('Runtime.evaluate', {
            expression,
            returnByValue: true,
            awaitPromise: true,
        });
        if (result.exceptionDetails) {
            throw new Error(`JS evaluation error: ${JSON.stringify(result.exceptionDetails)}`);
        }
        return result.result?.value;
    }
    async getDocument(depth = -1) {
        return this.send('DOM.getDocument', { depth, pierce: true });
    }
    async querySelectorAll(nodeId, selector) {
        const result = await this.send('DOM.querySelectorAll', { nodeId, selector });
        return result.nodeIds || [];
    }
    async getBoxModel(nodeId) {
        try {
            return await this.send('DOM.getBoxModel', { nodeId });
        }
        catch {
            return null;
        }
    }
    async getAttributes(nodeId) {
        try {
            const result = await this.send('DOM.getAttributes', { nodeId });
            const attrs = {};
            const flat = result.attributes || [];
            for (let i = 0; i < flat.length; i += 2) {
                attrs[flat[i]] = flat[i + 1];
            }
            return attrs;
        }
        catch {
            return {};
        }
    }
    async click(x, y) {
        await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
        await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    }
    async type(text) {
        for (const char of text) {
            await this.send('Input.dispatchKeyEvent', { type: 'keyDown', text: char });
            await this.send('Input.dispatchKeyEvent', { type: 'keyUp', text: char });
        }
    }
    async enableDOM() { await this.send('DOM.enable'); }
    async enableRuntime() { await this.send('Runtime.enable'); }
    async enablePage() { await this.send('Page.enable'); }
    async disconnect() {
        this._connected = false;
        this.eventHandlers.clear();
        for (const [, pending] of this.pending) {
            pending.reject(new Error('Disconnected'));
        }
        this.pending.clear();
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
//# sourceMappingURL=cdp.js.map