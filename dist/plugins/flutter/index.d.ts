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
import { FrameworkPlugin, PluginConnection, DetectedApp } from '../../types.js';
export declare class FlutterPlugin implements FrameworkPlugin {
    readonly framework: "flutter";
    readonly name = "Flutter (UIA Bridge)";
    readonly controlMethod: "flutter-uia";
    private uiaPlugin;
    canHandle(app: DetectedApp): boolean;
    connect(app: DetectedApp): Promise<PluginConnection>;
}
export default FlutterPlugin;
//# sourceMappingURL=index.d.ts.map