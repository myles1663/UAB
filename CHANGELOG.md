# Changelog

All notable changes to Universal App Bridge will be documented in this file.

## [0.9.0] - 2026-03-03

### Added

- **Vision Fallback Plugin** — Screenshot + AI + coordinate-based input injection as the ultimate last resort. Like Anthropic's computer use tool.
  - `VisionPlugin` — Priority 5 in the cascade, works with ANY visible application
  - `VisionAnalyzer` — Sends screenshots to Claude Vision API for UI element detection with bounding boxes
  - `VisionConnection` — Full PluginConnection implementation: enumerate, query, act, state
  - Coordinate-based input injection via Win32 API (mouse clicks, keyboard, window management)
  - Analysis caching (8s TTL) to avoid redundant API calls for rapid enumerate→query sequences
  - Comprehensive element type mapping (24 types with aliases) and action inference
  - Screenshot capture with base64 encoding for API calls + file persistence for audit
- **Automatic fallback integration** — ControlRouter now includes Vision as the final fallback after Win-UIA fails
  - Gracefully degrades: Framework Hook → Accessibility (Win-UIA) → Vision (AI)
  - Only activated when `ANTHROPIC_API_KEY` is configured (not added to cascade otherwise)
- New dependency: `@anthropic-ai/sdk` for Claude Vision API access

### Changed

- ControlRouter cascade extended from 4 to 5 priority levels
- Architecture documentation updated with Vision plugin details
- Test suite expanded: 172 tests (17 new vision tests)
- Package version bumped to 0.9.0

## [0.8.0] - 2026-03-03

### Added

- **Desktop + Server Dual-Mode Architecture** — ONE codebase works in both interactive desktop sessions and non-interactive server/SSH contexts. No separate builds needed.
- **Environment Detection (`environment.ts`)** — Automatic runtime detection with three modes:
  - `desktop` — Interactive Windows session (Session 1+), full UIA/CDP access
  - `server` — Non-interactive (SSH, service), uses Session 0→1 bridge via Task Scheduler
  - `container` — Docker/WSL/Hyper-V, limited desktop access
  - Auto-tunes connector defaults (persistence, rate limits, cache TTL) per environment
- **HTTP Server (`server.ts`)** — Zero-dependency REST API for remote UAB access:
  - All UAB operations exposed as JSON endpoints: `/scan`, `/apps`, `/find`, `/connect`, `/enumerate`, `/query`, `/act`, `/state`, `/keypress`, `/hotkey`, `/window`, `/screenshot`
  - Diagnostics: `/cache-stats`, `/audit-log`, `/health-summary`, `/environment`
  - Health check: `GET /health`, API listing: `GET /info`
  - Optional API key authentication via `X-API-Key` header
  - Localhost-only by default (security)
  - CORS headers for browser-based agents
- **CLI `serve` command** — Start the HTTP server from the command line: `uab serve [--port 3100] [--host 127.0.0.1] [--api-key secret]`
- **CLI `env` command** — Show detected environment and auto-tuned defaults
- **UABConnector auto-tuning** — Connector now auto-detects environment and applies optimal defaults for persistent connections, rate limiting, and extension bridge
- New package exports: `universal-app-bridge/server`, `universal-app-bridge/environment`

### Changed

- UABConnector constructor now accepts optional `mode` parameter to override auto-detection
- ConnectorOptions defaults are now environment-aware (desktop vs server vs container)
- CLI version bumped to 0.8.0
- Package description updated to reflect dual-mode capability
- Documentation updated with server-side usage, environment detection, and HTTP API reference

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
