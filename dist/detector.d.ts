/**
 * Framework Detector
 *
 * Identifies which UI framework a running application uses by inspecting
 * loaded DLLs, process signatures, and binary characteristics.
 * Windows-focused implementation with extensible platform support.
 *
 * Phase 3 Enhancement: Full DLL module scanning in detectAll() for
 * accurate framework detection across all running processes.
 */
import type { DetectedApp, FrameworkType } from './types.js';
export interface FrameworkSignature {
    framework: FrameworkType;
    modules: string[];
    commandLine: string[];
    filePatterns: string[];
    baseConfidence: number;
}
export declare const DETECTION_SIGNATURES: FrameworkSignature[];
export declare class FrameworkDetector {
    private cache;
    getSignatureInventory(): FrameworkSignature[];
    /**
     * Detect all controllable apps with enhanced DLL module scanning.
     * Uses batch PowerShell calls for performance — scans loaded DLLs
     * and window titles for all GUI processes in one shot.
     */
    detectAll(): Promise<DetectedApp[]>;
    detectElectron(): Promise<DetectedApp[]>;
    detectByPid(pid: number): Promise<DetectedApp | null>;
    findByName(name: string): Promise<DetectedApp[]>;
    clearCache(): void;
}
//# sourceMappingURL=detector.d.ts.map