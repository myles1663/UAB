# Changelog

All notable changes to Universal App Bridge will be documented in this file.

## [0.6.0] - 2026-03-02

### Added

- **Chrome Extension Bridge** — Control Chrome, Edge, Brave, and Chromium browsers via a locally-installed Manifest V3 extension. No browser relaunch required.
  - `ChromeExtPlugin` — Plugin adapter for the extension bridge
  - `ExtensionWSServer` — WebSocket server (port 8787) for extension communication
  - `installer.ts` — Helper utilities for extension installation and icon generation
  - `data/chrome-extension/` — Ready-to-load extension with service worker (1,076 lines)
- **Browser CDP Plugin** — Fallback browser control via Chrome DevTools Protocol for when the extension is not installed. Requires `--remote-debugging-port` flag.
  - Full tab management, cookies, localStorage/sessionStorage, DOM interaction, JS execution, screenshots
- **Browser-specific actions:** `getTabs`, `newTab`, `closeTab`, `switchTab`, `navigate`, `goBack`, `goForward`, `getCookies`, `setCookie`, `deleteCookie`, `clearCookies`, `getLocalStorage`, `setLocalStorage`, `getSessionStorage`, `setSessionStorage`, `executeScript`
- Extension auto-reconnects when UAB restarts (25-second service worker keepalive)
- `ws` added as a dependency for WebSocket server

### Changed

- Plugin priority order updated: Chrome Extension > Browser CDP > Electron > Office > Qt > GTK > Java > Flutter > Win32
- Architecture diagram updated to include browser plugins
- Package description updated to include Chrome
- Version bumped to 0.6.0

## [0.5.0] - 2026-03-01

### Added

- Initial release of Universal App Bridge
- Framework detection for Electron, Qt, GTK, WPF/.NET, Flutter, Java, Win32
- Chrome DevTools Protocol (CDP) connector for Electron apps
- Windows UI Automation universal fallback
- Office COM Automation plugin (Word, Excel, PowerPoint, Outlook)
- Unified API: `detect()`, `enumerate()`, `query()`, `act()`, `state()`
- CLI tool (`uab`) with JSON output for AI agent integration
- Action chains for multi-step workflows
- Smart element caching with TTL and invalidation
- Permission and safety model with risk levels and audit logging
- Connection health monitoring with auto-reconnect
- Retry with exponential backoff
- Business Source License 1.1
