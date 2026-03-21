/**
 * UAB Bridge Daemon (System Service)
 *
 * Installs UABServer as a background service that starts on boot.
 * - Mac: launchd (~/Library/LaunchAgents/)
 * - Windows: Task Scheduler (schtasks, user-level, no admin required)
 *
 * IMPORTANT: On Windows, all schtasks commands are run via cmd.exe
 * to avoid Git Bash path mangling (e.g., /create → C:/Program Files/Git/create).
 */
export declare function installDaemon(apiKey?: string): Promise<{
    success: boolean;
    message: string;
}>;
export declare function uninstallDaemon(): Promise<{
    success: boolean;
    message: string;
}>;
export declare function isDaemonInstalled(): Promise<boolean>;
export declare function isDaemonRunning(): Promise<boolean>;
export declare function startDaemon(): Promise<{
    success: boolean;
    message: string;
}>;
export declare function stopDaemon(): Promise<{
    success: boolean;
    message: string;
}>;
//# sourceMappingURL=daemon.d.ts.map