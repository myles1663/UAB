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
import { FrameworkPlugin, PluginConnection, DetectedApp } from '../../types.js';
export declare class GtkPlugin implements FrameworkPlugin {
    readonly framework: "gtk4";
    readonly name = "GTK (UIA Bridge)";
    private uiaPlugin;
    canHandle(app: DetectedApp): boolean;
    connect(app: DetectedApp): Promise<PluginConnection>;
}
export default GtkPlugin;
//# sourceMappingURL=index.d.ts.map