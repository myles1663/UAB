/**
 * Qt5/Qt6 Framework Plugin
 *
 * On Windows, Qt apps expose their UI through the Windows Accessibility
 * framework (QAccessible → MSAA/UIA bridge). This plugin detects Qt apps
 * by their loaded DLLs and connects via the Win UIA plugin.
 *
 * For extra control beyond what UIA provides, we can also inject commands
 * via Qt's own IPC mechanisms:
 *   - Qt5: Uses QDBus on Linux, QLocalServer on Windows
 *   - Qt6: Same + additional QML debugging via QML inspector
 *
 * Detection signals:
 *   - Qt5Core.dll / Qt6Core.dll loaded
 *   - Qt-specific window class names (e.g., "Qt5QWindowIcon", "Qt6QWindowIcon")
 *   - qApp command line flags
 */
import { FrameworkPlugin, PluginConnection, DetectedApp } from '../../types.js';
export declare class QtPlugin implements FrameworkPlugin {
    readonly framework: "qt6";
    readonly name = "Qt (UIA Bridge)";
    private uiaPlugin;
    canHandle(app: DetectedApp): boolean;
    connect(app: DetectedApp): Promise<PluginConnection>;
}
export default QtPlugin;
