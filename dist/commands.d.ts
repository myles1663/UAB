/**
 * UAB Telegram Commands
 *
 * Registers bot commands that let the user interact with
 * the Universal App Bridge directly from Telegram.
 *
 * Commands:
 *   /apps          — Scan for running desktop apps
 *   /appconnect    — Connect to an app by name or PID
 *   /appdisconnect — Disconnect from an app
 *   /ui            — Search UI elements in a connected app
 *   /click         — Click a UI element
 *   /apptype       — Type text into a UI element
 *   /appstate      — Get current app state
 *   /uabstatus     — Show UAB service status
 *   Phase 3:
 *   /keypress      — Send a keypress
 *   /hotkey        — Send a hotkey combo
 *   /appwin        — Window management
 *   /screenshot    — Capture window screenshot
 *   Phase 4:
 *   /uabhealth     — Connection health status
 *   /uabcache      — Cache statistics
 *   /uabaudit      — Recent action audit log
 *   /chain         — Execute action chain (JSON)
 */
import type { Bot, Context } from 'grammy';
export declare function registerUABCommands(bot: Bot<Context>): void;
