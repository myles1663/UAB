# Changelog

All notable changes to Universal App Bridge will be documented in this file.

## [0.7.0] - 2026-03-03

### Added

- **Smart Function Discovery Pipeline** — Five-phase process: Scan → Identify → Register → Connect → Learn. The core intelligence of UAB.
- **UABConnector** — Framework-independent connector class. Instantiable (not singleton), zero dependencies on any agent framework. Primary API for all consumers.
  - `scan()` — Full system detection with batch DLL scanning, framework identification, and registry population
  - `apps()` — Instant recall from registry (no scan needed)
  - `find()` — Smart lookup: checks registry first (O(1)), falls back to live detection
  - `inspectPid()` — Single-PID lookup with registry-first strategy
  - `connect()` — Auto-selects best control method via plugin cascade with learning
- **AppRegistry** — In-memory knowledge base with JSON persistence. UAB's "brain."
  - Dual-indexed Maps: O(1) lookup by PID and by executable name
  - Git-friendly JSON file persistence (`data/uab-profiles/registry.json`)
  - Auto-save on mutation with deferred save for bulk operations
  - Cross-session survival — remembers apps, frameworks, and preferred methods
- **Learning Loop** — After successful connection, registry is updated with the method that worked. Next connection to the same app is faster.
- **Batch Processing** — DLL module scanning batched (50 PIDs per PowerShell call). Window title scanning via single P/Invoke call. Full system scan in 2-5 seconds.
- **CLI smart discovery commands:** `scan`, `apps`, `find`, `profiles`
- **Comprehensive documentation** reflecting Smart Function Discovery architecture:
  - `README.md` — Smart discovery front and center
  - `ARCHITECTURE.md` — Full five-phase pipeline documentation with diagrams
  - `API_REFERENCE.md` — UABConnector as primary API with AppRegistry reference
  - `GETTING_STARTED.md` — Smart discovery walkthrough
  - `SECURITY.md`, `CONTRIBUTING.md`, `SUPPORTED_APPLICATIONS.md`
  - `docs/design-decisions.md` — 15 architectural decisions with rationale
  - `docs/roadmap.md` — Updated completed phases and future plans

### Changed

- UABConnector is now the primary API (UABService remains for single-consumer use)
- Documentation completely rewritten to showcase Smart Function Discovery
- Package version bumped to 0.7.0
- License field updated to `BSL-1.1`
- Source now includes 30 TypeScript files (~11,700 LOC)

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
