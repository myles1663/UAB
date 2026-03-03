/**
 * Windows UI Automation Plugin — Phase 3 Enhanced
 *
 * Controls desktop apps via the Windows UI Automation API (UIA).
 * This is the "accessibility" fallback in the control router —
 * it works with virtually any Windows GUI app: WPF, WinForms,
 * Qt, GTK, Java Swing, native Win32, and more.
 *
 * Phase 3 Enhancements:
 *   - Keyboard input (keypress, hotkey combos)
 *   - Window management (minimize, maximize, restore, move, resize, close)
 *   - Screenshot capture (per-window via Win32 API)
 *   - Deep WPF patterns (TextPattern, GridPattern, ScrollItemPattern)
 *
 * Implementation: Spawns PowerShell processes that use the
 * System.Windows.Automation .NET namespace and Win32 APIs.
 */
import { FrameworkPlugin, PluginConnection, DetectedApp } from '../../types.js';
export declare class WinUIAPlugin implements FrameworkPlugin {
    readonly framework: "wpf";
    readonly name = "Windows UI Automation";
    canHandle(app: DetectedApp): boolean;
    connect(app: DetectedApp): Promise<PluginConnection>;
}
export default WinUIAPlugin;
