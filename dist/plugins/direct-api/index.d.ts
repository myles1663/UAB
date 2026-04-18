import type { DetectedApp, FrameworkPlugin, PluginConnection } from '../../types.js';
export declare class DirectApiPlugin implements FrameworkPlugin {
    readonly framework: "unknown";
    readonly name = "Direct API Plugin";
    readonly controlMethod: "direct-api";
    canHandle(app: DetectedApp): boolean;
    connect(app: DetectedApp): Promise<PluginConnection>;
}
//# sourceMappingURL=index.d.ts.map