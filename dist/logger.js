/**
 * UAB Logger — Self-contained structured logger for the Universal App Bridge.
 *
 * This is a lightweight logger that works standalone without any
 * dependency on Kai's logger infrastructure.
 * Writes to console only by default; file logging can be enabled
 * by setting UAB_LOG_FILE environment variable.
 */
import fs from 'fs';
import path from 'path';
const LEVEL_PRIORITY = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
const minLevel = process.env.UAB_LOG_LEVEL || process.env.LOG_LEVEL || 'info';
const logFilePath = process.env.UAB_LOG_FILE || '';
let logStream = null;
function getLogStream() {
    if (!logFilePath)
        return null;
    if (!logStream) {
        const dir = path.dirname(logFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
    }
    return logStream;
}
function shouldLog(level) {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}
function formatMessage(level, module, message, data) {
    const ts = new Date().toISOString();
    const base = `${ts} [${level.toUpperCase().padEnd(5)}] [uab:${module}] ${message}`;
    if (data && Object.keys(data).length > 0) {
        return `${base} ${JSON.stringify(data)}`;
    }
    return base;
}
export function createLogger(module) {
    function log(level, message, data) {
        if (!shouldLog(level))
            return;
        const formatted = formatMessage(level, module, message, data);
        switch (level) {
            case 'error':
                console.error(formatted);
                break;
            case 'warn':
                console.warn(formatted);
                break;
            default:
                console.log(formatted);
        }
        try {
            const stream = getLogStream();
            stream?.write(formatted + '\n');
        }
        catch {
            // Don't crash on log write failure
        }
    }
    return {
        debug: (msg, data) => log('debug', msg, data),
        info: (msg, data) => log('info', msg, data),
        warn: (msg, data) => log('warn', msg, data),
        error: (msg, data) => log('error', msg, data),
    };
}
export function closeLogger() {
    logStream?.end();
    logStream = null;
}
//# sourceMappingURL=logger.js.map