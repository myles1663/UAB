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
import type { DetectedApp } from './types.js';
export declare class FrameworkDetector {
    private cache;
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
