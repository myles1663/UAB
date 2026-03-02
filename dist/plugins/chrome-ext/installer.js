/**
 * Chrome Extension Auto-Installer
 *
 * Registers the UAB Bridge extension for automatic installation
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
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { deflateSync } from 'zlib';
import { createLogger } from '../../logger.js';
const log = createLogger('chrome-ext-installer');
/** Get the absolute path to the extension directory */
export function getExtensionPath() {
    return resolve('data/chrome-extension');
}
/** Check if the extension files exist */
export function extensionExists() {
    const extPath = getExtensionPath();
    return existsSync(`${extPath}/manifest.json`) &&
        existsSync(`${extPath}/service-worker.js`);
}
/** Get extension version from manifest */
export function getExtensionVersion() {
    try {
        const manifest = JSON.parse(readFileSync(`${getExtensionPath()}/manifest.json`, 'utf-8'));
        return manifest.version || '1.0.0';
    }
    catch {
        return '1.0.0';
    }
}
/**
 * Generate placeholder icon PNGs so Chrome doesn't complain.
 * Creates minimal valid PNG files (1x1 pixel, transparent).
 */
export function generateIcons() {
    const extPath = getExtensionPath();
    // Minimal 1x1 transparent PNG (smallest valid PNG)
    // PNG signature + IHDR + IDAT + IEND
    const createMinPng = (size) => {
        // For a simple icon, we'll create a colored square
        // This is a minimal valid PNG with the UAB purple
        const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
        // IHDR chunk
        const ihdr = Buffer.alloc(25);
        ihdr.writeUInt32BE(13, 0); // length
        ihdr.write('IHDR', 4);
        ihdr.writeUInt32BE(size, 8); // width
        ihdr.writeUInt32BE(size, 12); // height
        ihdr.writeUInt8(8, 16); // bit depth
        ihdr.writeUInt8(2, 17); // color type (RGB)
        ihdr.writeUInt8(0, 18); // compression
        ihdr.writeUInt8(0, 19); // filter
        ihdr.writeUInt8(0, 20); // interlace
        // Calculate CRC for IHDR
        const crc32 = crc(ihdr.subarray(4, 21));
        ihdr.writeInt32BE(crc32, 21);
        // IDAT chunk - raw uncompressed pixel data
        // Each row: filter byte (0) + RGB pixels
        const rowSize = 1 + size * 3;
        const rawData = Buffer.alloc(rowSize * size);
        for (let y = 0; y < size; y++) {
            rawData[y * rowSize] = 0; // filter: none
            for (let x = 0; x < size; x++) {
                const offset = y * rowSize + 1 + x * 3;
                // Purple color (#7C3AED)
                rawData[offset] = 0x7C; // R
                rawData[offset + 1] = 0x3A; // G
                rawData[offset + 2] = 0xED; // B
            }
        }
        // Compress with deflate (zlib)
        const compressed = deflateSync(rawData);
        const idat = Buffer.alloc(compressed.length + 12);
        idat.writeUInt32BE(compressed.length, 0);
        idat.write('IDAT', 4);
        compressed.copy(idat, 8);
        const idatCrc = crc(Buffer.concat([Buffer.from('IDAT'), compressed]));
        idat.writeInt32BE(idatCrc, compressed.length + 8);
        // IEND chunk
        const iend = Buffer.from([0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
        return Buffer.concat([pngSignature, ihdr, idat, iend]);
    };
    // CRC32 implementation for PNG chunks
    function crc(data) {
        let c = 0xFFFFFFFF;
        const table = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let v = n;
            for (let k = 0; k < 8; k++) {
                v = (v & 1) ? (0xEDB88320 ^ (v >>> 1)) : (v >>> 1);
            }
            table[n] = v;
        }
        for (let i = 0; i < data.length; i++) {
            c = table[(c ^ data[i]) & 0xFF] ^ (c >>> 8);
        }
        return (c ^ 0xFFFFFFFF) | 0;
    }
    for (const size of [16, 48, 128]) {
        const iconPath = `${extPath}/icon${size}.png`;
        if (!existsSync(iconPath)) {
            writeFileSync(iconPath, createMinPng(size));
            log.info(`Generated icon: icon${size}.png`);
        }
    }
}
/**
 * Get installation instructions for the user.
 * Returns a formatted string explaining how to load the extension.
 */
export function getInstallInstructions() {
    const extPath = getExtensionPath().replace(/\//g, '\\');
    return [
        '🧩 Chrome Extension Installation:',
        '',
        '1. Open Chrome and go to: chrome://extensions/',
        '2. Enable "Developer mode" (toggle in top-right)',
        '3. Click "Load unpacked"',
        `4. Select folder: ${extPath}`,
        '5. The extension will connect automatically!',
        '',
        '📌 The extension auto-reconnects when the UAB server restarts.',
        '📌 You only need to do this ONCE — Chrome remembers it.',
    ].join('\n');
}
/**
 * Attempt to register the extension via Windows registry
 * for automatic loading. This is a "soft" install that
 * Chrome will pick up on next restart.
 *
 * Note: This only works for .crx packaged extensions or
 * extensions hosted at a URL. For unpacked extensions,
 * manual loading via chrome://extensions is required.
 */
export function registerViaRegistry() {
    // For now, registry-based install requires a .crx file which
    // needs the extension to be published or self-signed.
    // The manual developer mode approach is simpler and works great.
    return {
        success: false,
        message: 'Registry install not yet supported for unpacked extensions. Use developer mode instead.',
    };
}
/**
 * Check if Chrome is running with the extension loaded.
 * Tries to detect the extension's WebSocket connection.
 */
export function isExtensionActive(wsConnected) {
    return wsConnected;
}
//# sourceMappingURL=installer.js.map