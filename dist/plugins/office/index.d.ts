/**
 * Microsoft Office Framework Plugin
 *
 * Provides deep integration with Office apps (Word, Excel, PowerPoint,
 * Outlook) by combining UIA accessibility with Office-specific
 * capabilities:
 *
 *   - Document content reading via UIA TextPattern
 *   - Excel cell/range reading via UIA GridPattern + ValuePattern
 *   - Excel cell writing via UIA ValuePattern
 *   - Office Ribbon navigation with friendly names
 *   - Smart element labeling for Office-specific controls
 *
 * Detection: WINWORD.EXE, EXCEL.EXE, POWERPNT.EXE, OUTLOOK.EXE, etc.
 * Falls back to Win-UIA for standard UI actions.
 */
import { FrameworkPlugin, PluginConnection, DetectedApp, ActionParams } from '../../types.js';
export declare function buildExcelPivotTableScript(pid: number, params?: ActionParams): string;
export declare function buildExcelChartScript(pid: number, params?: ActionParams): string;
export declare function buildExcelConditionalFormattingScript(pid: number, params?: ActionParams): string;
export declare class OfficePlugin implements FrameworkPlugin {
    readonly framework: "office";
    readonly name = "Microsoft Office (UIA + Office Patterns)";
    readonly controlMethod: "office-com+uia";
    private uiaPlugin;
    canHandle(app: DetectedApp): boolean;
    connect(app: DetectedApp): Promise<PluginConnection>;
}
export default OfficePlugin;
//# sourceMappingURL=index.d.ts.map