/**
 * Chrome Extension Auto-Installer
 *
 * Registers the ClaudeClaw Bridge extension for automatic installation
 * via Windows registry (external extensions mechanism).
 *
 * How it works:
 *   1. Generates a stable extension ID from the extension path
 *   2. Creates a registry key under HKLM\SOFTWARE\Google\Chrome\Extensions\<id>
 *   3. Chrome picks up the extension on next startup
 *   4. User sees "New extension added" notification
 *
 * For Edge:
 *   Uses HKLM\SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist
 *
 * Note: For developer mode (current approach), users load the extension
 * manually from chrome://extensions. The registry approach requires the
 * extension to be packaged as a .crx file.
 */
/** Get the absolute path to the extension directory */
export declare function getExtensionPath(): string;
/** Check if the extension files exist */
export declare function extensionExists(): boolean;
/** Get extension version from manifest */
export declare function getExtensionVersion(): string;
/**
 * Generate placeholder icon PNGs so Chrome doesn't complain.
 * Creates minimal valid PNG files (1x1 pixel, transparent).
 */
export declare function generateIcons(): void;
/**
 * Get installation instructions for the user.
 * Returns a formatted string explaining how to load the extension.
 */
export declare function getInstallInstructions(): string;
/**
 * Attempt to register the extension via Windows registry
 * for automatic loading. This is a "soft" install that
 * Chrome will pick up on next restart.
 *
 * Note: This only works for .crx packaged extensions or
 * extensions hosted at a URL. For unpacked extensions,
 * manual loading via chrome://extensions is required.
 */
export declare function registerViaRegistry(): {
    success: boolean;
    message: string;
};
/**
 * Check if Chrome is running with the extension loaded.
 * Tries to detect the extension's WebSocket connection.
 */
export declare function isExtensionActive(wsConnected: boolean): boolean;
