/**
 * Java Swing / JavaFX Framework Plugin
 *
 * Java apps expose accessibility via the Java Access Bridge (JAB).
 * On Windows, JAB bridges to MSAA/UIA, so we route through Win UIA.
 *
 * Detection signals:
 *   - jvm.dll loaded
 *   - java.exe / javaw.exe process name
 *   - -jar flag in command line
 *   - WindowsForms class name containing "SunAwtFrame" (Swing) or "Glass" (JavaFX)
 *
 * Note: Java Access Bridge must be enabled on the system:
 *   Control Panel → Ease of Access → Java Access Bridge
 *   Or: jabswitch.exe -enable
 */
import { FrameworkPlugin, PluginConnection, DetectedApp } from '../../types.js';
export declare class JavaPlugin implements FrameworkPlugin {
    readonly framework: "java-swing";
    readonly name = "Java (UIA via JAB)";
    private uiaPlugin;
    canHandle(app: DetectedApp): boolean;
    connect(app: DetectedApp): Promise<PluginConnection>;
}
export default JavaPlugin;
