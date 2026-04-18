/**
 * GTK3/GTK4 Framework Plugin
 *
 * On Windows, GTK apps can expose accessibility via:
 *   - ATK → MSAA/UIA bridge (GTK3 with at-spi2-atk)
 *   - GTK4's built-in accessibility (maps to platform A11y APIs)
 *   - Fallback: Windows UI Automation (partial coverage)
 *
 * Detection signals:
 *   - libgtk-3-0.dll / libgtk-4-1.dll loaded
 *   - GdkWindow class names
 *   - GIMP, Inkscape, GNOME apps on Windows use GTK
 *
 * On Linux: Would use AT-SPI2 D-Bus interface for direct access.
 * On Windows: Leverages the Win UIA plugin through ATK→MSAA bridge.
 */
import { WinUIAPlugin } from '../win-uia/index.js';
// ─── GTK Plugin ─────────────────────────────────────────────
export class GtkPlugin {
    framework = 'gtk4';
    name = 'GTK (UIA Bridge)';
    controlMethod = 'gtk-uia';
    uiaPlugin = new WinUIAPlugin();
    canHandle(app) {
        return app.framework === 'gtk3' || app.framework === 'gtk4';
    }
    async connect(app) {
        // GTK on Windows exposes accessibility via ATK → MSAA/UIA bridge
        const connection = await this.uiaPlugin.connect(app);
        return new GtkConnection(app, connection);
    }
}
/**
 * GTK connection wraps UIA with GTK-specific metadata.
 */
class GtkConnection {
    app;
    uiaConn;
    constructor(app, uiaConn) {
        this.app = app;
        this.uiaConn = uiaConn;
    }
    get connected() { return this.uiaConn.connected; }
    async enumerate() {
        const elements = await this.uiaConn.enumerate();
        return elements.map(el => this.tagGtk(el));
    }
    async query(selector) {
        const elements = await this.uiaConn.query(selector);
        return elements.map(el => this.tagGtk(el));
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
    tagGtk(el) {
        return {
            ...el,
            meta: { ...el.meta, pluginSource: 'gtk', gtkVersion: this.app.framework === 'gtk4' ? 4 : 3 },
            children: el.children.map(c => this.tagGtk(c)),
        };
    }
}
export default GtkPlugin;
//# sourceMappingURL=index.js.map