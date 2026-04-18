/**
 * Flutter Framework Plugin
 *
 * Flutter apps on Windows use the Flutter Embedder which creates
 * a custom rendering surface. Flutter 3.x+ includes accessibility
 * support that bridges to Windows UIA via SemanticsNode → UIA mapping.
 *
 * Detection signals:
 *   - flutter_windows.dll / flutter_engine.dll loaded
 *   - FlutterDesktopView window class
 *
 * For enhanced control, Flutter apps can be connected via the
 * Dart VM Service Protocol (--observatory-port) for deep inspection,
 * but the UIA bridge provides good coverage for standard interactions.
 */
import { WinUIAPlugin } from '../win-uia/index.js';
export class FlutterPlugin {
    framework = 'flutter';
    name = 'Flutter (UIA Bridge)';
    controlMethod = 'flutter-uia';
    uiaPlugin = new WinUIAPlugin();
    canHandle(app) {
        return app.framework === 'flutter';
    }
    async connect(app) {
        const connection = await this.uiaPlugin.connect(app);
        return new FlutterConnection(app, connection);
    }
}
class FlutterConnection {
    app;
    uiaConn;
    constructor(app, uiaConn) {
        this.app = app;
        this.uiaConn = uiaConn;
    }
    get connected() { return this.uiaConn.connected; }
    async enumerate() {
        const elements = await this.uiaConn.enumerate();
        return elements.map(el => this.tagFlutter(el));
    }
    async query(selector) {
        const elements = await this.uiaConn.query(selector);
        return elements.map(el => this.tagFlutter(el));
    }
    async act(elementId, action, params) {
        return this.uiaConn.act(elementId, action, params);
    }
    async state() {
        return this.uiaConn.state();
    }
    async subscribe(event, callback) {
        return this.uiaConn.subscribe(event, callback);
    }
    async disconnect() {
        return this.uiaConn.disconnect();
    }
    tagFlutter(el) {
        return {
            ...el,
            meta: { ...el.meta, pluginSource: 'flutter' },
            children: el.children.map(c => this.tagFlutter(c)),
        };
    }
}
export default FlutterPlugin;
//# sourceMappingURL=index.js.map