# Contributing to Universal App Bridge

Thanks for considering contributing to UAB! This document covers the process for contributing code, reporting issues, and the standards we follow.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Set Up](#getting-set-up)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Writing Plugins](#writing-plugins)
- [Issue Guidelines](#issue-guidelines)

---

## Code of Conduct

Be respectful, constructive, and professional. We're building infrastructure that AI agents depend on — reliability and clarity matter more than cleverness.

---

## Getting Set Up

### Prerequisites

- Node.js >= 18.0.0
- Windows 10/11 (for running the full test suite)
- Git

### Clone and Install

```bash
git clone https://github.com/myles1663/UAB.git
cd universal-app-bridge
npm install
```

### Build

```bash
npm run build
```

### Run Tests

```bash
npm run test         # Run once
npm run test:watch   # Watch mode
```

### Verify Everything Works

```bash
node dist/uab/cli.js detect
```

You should see JSON output listing detected applications.

---

## Development Workflow

1. **Create a branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** in `src/uab/`

3. **Build and test:**
   ```bash
   npm run build && npm run test
   ```

4. **Commit** with a clear message:
   ```
   feat(uab): add support for WinUI3 detection
   fix(cache): handle race condition in TTL expiry
   docs: update API reference for new chain step types
   ```

5. **Push and open a PR** against `main`

### Commit Message Format

```
<type>(<scope>): <description>

[optional body]
```

| Type | Usage |
|------|-------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `test` | Adding/updating tests |
| `refactor` | Code restructuring (no behavior change) |
| `perf` | Performance improvement |
| `chore` | Build, config, tooling |

---

## Code Style

### TypeScript

- **Strict mode** — `strict: true` in tsconfig.json
- **ES Modules** — `"type": "module"` in package.json
- **Explicit types** on public API surfaces (function params, return types)
- **Interface over type** for object shapes
- **Descriptive names** — `elementId` not `eid`, `actionResult` not `res`

### File Organization

```
src/uab/
├── types.ts              # Core type definitions (modify carefully)
├── index.ts              # Public API exports
├── service.ts            # Main UABService class
├── router.ts             # Control method routing
├── detector.ts           # Framework detection
├── cache.ts              # Element caching
├── permissions.ts        # Safety model
├── connection-manager.ts # Health monitoring
├── chains.ts             # Workflow engine
├── retry.ts              # Retry utilities
├── cli.ts                # CLI interface
├── commands.ts           # Telegram command handlers
├── logger.ts             # Logging
├── ps-exec.ts            # PowerShell execution
└── plugins/
    ├── base.ts           # Plugin manager
    ├── electron/         # Electron CDP plugin
    ├── browser/          # Browser CDP plugin
    ├── office/           # Office COM+UIA plugin
    ├── win-uia/          # Universal UIA fallback
    ├── chrome-ext/       # Chrome extension bridge
    ├── qt/               # Qt via UIA
    ├── gtk/              # GTK via UIA
    ├── java/             # Java via JAB→UIA
    └── flutter/          # Flutter via UIA
```

### Conventions

- One class per file (for core components)
- Export from `index.ts` for public API
- Use `createLogger('module-name')` for all logging
- Use `withRetry()` for any external call that might fail transiently
- Invalidate cache after mutating actions

---

## Testing

### Test Structure

```
tests/
└── uab/
    └── smoke.test.ts    # Core component tests
```

### Writing Tests

- Use **Vitest** (`describe`, `it`, `expect`)
- Test each component in isolation where possible
- For OS-dependent tests (detection, UIA), use timeouts and graceful fallbacks
- Mock external dependencies (PowerShell, CDP) for unit tests

### Running Specific Tests

```bash
# Run UAB tests only
npx vitest run tests/uab/

# Run with verbose output
npx vitest run --reporter=verbose

# Watch mode for a specific file
npx vitest watch tests/uab/smoke.test.ts
```

### Current Test Coverage

| Suite | Tests | What's Covered |
|-------|-------|----------------|
| FrameworkDetector | 3 | Instantiation, detectAll, explorer detection |
| ElementCache | 7 | Tree/query cache, invalidation, stats |
| PermissionManager | 7 | Risk levels, blocking, confirmation, rate limiting, audit |
| Retry Utility | 5 | Success, retry, exhaustion, non-retryable, timeout |

---

## Submitting Changes

### Pull Request Guidelines

1. **One feature/fix per PR** — keep changes focused
2. **Include tests** for new functionality
3. **Update docs** if you change public API
4. **All tests must pass** — `npm run test`
5. **Build must succeed** — `npm run build`

### PR Description Template

```markdown
## What

Brief description of what changed.

## Why

Why this change is needed.

## Testing

How you tested it (specific apps, scenarios).

## Breaking Changes

List any breaking changes (if none, state "None").
```

### Review Process

1. Maintainer reviews code within 48 hours
2. Address feedback in new commits (don't force-push during review)
3. Squash merge into `main` after approval

---

## Writing Plugins

Want to add support for a new UI framework? Here's the pattern:

### 1. Create Plugin Directory

```
src/uab/plugins/your-framework/
├── index.ts    # Plugin class
└── ...         # Supporting files
```

### 2. Implement FrameworkPlugin

```typescript
import type { FrameworkPlugin, PluginConnection, DetectedApp } from '../base.js';

export class YourPlugin implements FrameworkPlugin {
  readonly framework = 'your-framework' as FrameworkType;
  readonly name = 'Your Framework Plugin';

  canHandle(app: DetectedApp): boolean {
    // Return true if this app uses your framework
    return app.framework === 'your-framework';
  }

  async connect(app: DetectedApp): Promise<PluginConnection> {
    // Establish connection to the app
    // Return a PluginConnection implementation
  }
}
```

### 3. Implement PluginConnection

```typescript
class YourConnection implements PluginConnection {
  async enumerate(): Promise<UIElement[]> { /* ... */ }
  async query(selector: ElementSelector): Promise<UIElement[]> { /* ... */ }
  async act(elementId: string, action: ActionType, params?: ActionParams): Promise<ActionResult> { /* ... */ }
  async state(): Promise<AppState> { /* ... */ }
  async disconnect(): Promise<void> { /* ... */ }
  get connected(): boolean { /* ... */ }
}
```

### 4. Register in Service

Add your plugin to `service.ts`:

```typescript
import { YourPlugin } from './plugins/your-framework/index.js';

// In start():
this.pluginManager.register(new YourPlugin());
```

### 5. Add Detection Signature

In `detector.ts`, add your framework's signature:

```typescript
{
  framework: 'your-framework',
  modules: ['your-framework.dll'],
  commandLine: [],
  filePatterns: [],
  baseConfidence: 0.85
}
```

### 6. Add Tests

Add test cases in `tests/uab/` for your plugin.

---

## Issue Guidelines

### Bug Reports

Include:
- UAB version
- Node.js version
- Windows version
- Target application and version
- Steps to reproduce
- Expected vs actual behavior
- Error messages / stack traces

### Feature Requests

Include:
- What you want to accomplish
- Which applications/frameworks this involves
- Why existing approaches don't work
- Proposed approach (if you have one)

---

## License

By contributing to UAB, you agree that your contributions will be licensed under the [Business Source License 1.1](LICENSE).
