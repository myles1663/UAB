# Security

UAB's security model is designed for enterprise environments where AI agents need controlled, auditable access to desktop applications. Security is built into every phase of the Smart Function Discovery pipeline — from scan to action.

---

## Table of Contents

- [Threat Model](#threat-model)
- [Trust Boundaries](#trust-boundaries)
- [Permission & Safety Model](#permission--safety-model)
- [Credential Handling](#credential-handling)
- [Audit Trail](#audit-trail)
- [Rate Limiting](#rate-limiting)
- [Network Security](#network-security)
- [Governance Integration](#governance-integration)
- [Responsible Disclosure](#responsible-disclosure)
- [API Key Authentication (v1.0.0)](#api-key-authentication-v100)
- [ELECTRON_ENABLE_REMOTE_DEBUGGING](#electron_enable_remote_debugging)

---

## Threat Model

### What UAB Controls

UAB interacts with desktop applications through OS-level automation APIs. It can:
- Read UI element trees (labels, values, states)
- Perform UI actions (click, type, navigate)
- Read/write application data (cells, documents, cookies)
- Send keyboard input
- Manage windows (move, resize, minimize, close)
- Take screenshots

### What UAB Does NOT Do

- **No file system access** — UAB does not read or write files directly. All interaction is through application UI or automation APIs.
- **No network requests** — UAB does not make outbound network calls (except localhost CDP connections to browsers/Electron apps).
- **No process injection** — UAB does not inject code into target processes. It uses existing debug/automation interfaces.
- **No kernel-level hooks** — UAB operates entirely in user space through documented Windows APIs.
- **No credential storage** — UAB does not store, cache, or transmit credentials.

---

## Trust Boundaries

```
┌─────────────────────────────────────────────────────┐
│                    Trust Zone 1                      │
│                  Agent Runtime                       │
│                                                     │
│  The agent (Claude, GPT, etc.) issues commands      │
│  to UAB. The agent is trusted to make reasonable    │
│  requests within its permission scope.              │
└────────────────────┬────────────────────────────────┘
                     │
            ─────────┼───────── Trust Boundary ─────────
                     │
┌────────────────────┴────────────────────────────────┐
│                    Trust Zone 2                      │
│                   UAB Service                        │
│                                                     │
│  UAB validates, rate-limits, and audits every       │
│  action before execution. Destructive actions       │
│  can be gated behind confirmation.                  │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │  Permission Manager                          │   │
│  │  - Risk classification (safe/moderate/dest.) │   │
│  │  - Rate limiting (100 actions/min per PID)   │   │
│  │  - Audit logging (all actions recorded)      │   │
│  │  - Destructive action gating                 │   │
│  └──────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────┘
                     │
            ─────────┼───────── Trust Boundary ─────────
                     │
┌────────────────────┴────────────────────────────────┐
│                    Trust Zone 3                      │
│              Target Applications                     │
│                                                     │
│  Desktop apps controlled via their own automation   │
│  interfaces (CDP, COM, UIA). UAB has the same       │
│  access as the logged-in user — no privilege        │
│  escalation.                                        │
└─────────────────────────────────────────────────────┘
```

### Key Principle: Same-User Access

UAB operates with the **same permissions as the logged-in user**. It cannot:
- Access apps running in other user sessions
- Bypass UAC prompts
- Access protected system processes
- Escalate privileges

If the user can't click a button, UAB can't click it either.

---

## Permission & Safety Model

### Risk Classification

Every action is classified by risk level before execution:

| Risk Level | Actions | Default Behavior |
|------------|---------|-----------------|
| **Safe** | click, doubleclick, rightclick, focus, hover, scroll, screenshot, minimize, maximize, restore, move, resize | Always allowed |
| **Moderate** | type, clear, select, check, uncheck, toggle, expand, collapse, invoke, keypress, hotkey | Allowed, logged |
| **Destructive** | close | Configurable: allow or block |

### Destructive Action Gating

When `blockDestructive: true` is configured:

1. Agent requests `close` action
2. PermissionManager blocks it
3. Agent must call `confirmDestructive(pid)` first
4. Only then does `close` succeed
5. Confirmation can be revoked with `revokeDestructive(pid)`

This prevents accidental window closure and data loss.

### Configuration

```typescript
const perms = new PermissionManager({
  blockDestructive: true,    // Require confirmation for close
  rateLimit: 50,             // 50 actions per minute per PID
  rateLimitWindow: 60000,    // 1-minute window
  maxAuditEntries: 5000,     // Keep last 5000 actions
  exemptPids: new Set([pid]) // PIDs exempt from rate limiting
});
```

---

## Credential Handling

### No Credentials Stored

UAB does not:
- Store API keys or passwords
- Cache authentication tokens
- Save browser session cookies to disk
- Record sensitive form field values in audit logs

### Browser Cookie Access

When using the BrowserPlugin, UAB can read/set cookies via CDP. This is:
- **Same-origin scoped** — only cookies the browser would expose to DevTools
- **Session-scoped** — UAB connection to CDP is ephemeral
- **Logged** — all cookie operations appear in the audit trail
- **Not persisted** — UAB does not write cookies to its own storage

### COM Object Lifecycle

Office COM automation objects are:
- Created per-connection
- Released on disconnect
- Not serialized or cached
- Garbage collected by the .NET runtime

---

## Audit Trail

Every action goes through the audit system:

```typescript
{
  timestamp: 1709500000000,     // Unix timestamp (ms)
  pid: 1234,                    // Target process
  appName: "EXCEL.EXE",        // Application name
  action: "writeCell",         // Action performed
  elementId: "cell-A1",        // Target element
  riskLevel: "moderate",       // Risk classification
  allowed: true,               // Whether action was permitted
  reason: undefined            // Block reason (if blocked)
}
```

### Audit Access

```typescript
// Get last 50 actions
const log = perms.getAuditLog(50);

// Get actions for specific app
const excelLog = perms.getAuditForPid(excelPid, 100);

// Via CLI (Telegram bot)
/uabaudit 20
```

### Audit Retention

- Default: last 1000 entries (configurable)
- In-memory only — not persisted to disk
- Clears on service restart
- For persistent audit logging, configure `UAB_LOG_FILE` environment variable

---

## Rate Limiting

### Default Configuration

- **100 actions per PID per 60 seconds**
- Sliding window implementation
- Configurable per PermissionManager instance

### Rate Limit Response

When rate-limited, actions are blocked with:

```typescript
{
  allowed: false,
  riskLevel: "safe",
  reason: "Rate limited: 100/100 actions in 60s window"
}
```

### Rate Limit Status

```typescript
const status = perms.getRateLimitStatus(pid);
// { count: 85, remaining: 15, resetMs: 23000 }
```

### Exemptions

Specific PIDs can be exempted from rate limiting:

```typescript
const perms = new PermissionManager({
  exemptPids: new Set([trustedPid])
});
```

---

## Network Security

### Localhost Only

All UAB network connections are **localhost only**:

| Protocol | Endpoint | Purpose |
|----------|----------|---------|
| CDP WebSocket | `ws://localhost:<port>` | Electron/Browser control |
| HTTP Server | `http://0.0.0.0:3100` | UABServer REST API |
| Chrome Extension | `ws://localhost:8787` | Extension bridge |
| PowerShell | Local process | UIA/COM execution |

UAB makes **zero outbound internet connections**.

### CDP Port Security

- CDP debugging ports are **not exposed** by default
- For Electron apps, the `--remote-debugging-port` flag must be explicitly set
- For browsers, UAB discovers or configures the debug port locally
- Ports are bound to `127.0.0.1` (loopback only)

---

## Governance Integration

### For Enterprise Deployments

UAB's permission and audit systems are designed as extension points for enterprise governance:

1. **Custom PermissionManager** — Subclass or wrap to integrate with your policy engine
2. **Audit log export** — Read audit entries and forward to SIEM/logging infrastructure
3. **Risk level override** — Reclassify actions based on organizational policy
4. **PID allowlisting** — Restrict UAB to approved applications only
5. **Action allowlisting** — Restrict to specific action types

### Example: Enterprise Wrapper

```typescript
import { PermissionManager } from 'universal-app-bridge';

class EnterprisePermissions extends PermissionManager {
  private allowedApps: Set<string>;

  constructor(allowedApps: string[]) {
    super({ blockDestructive: true, rateLimit: 50 });
    this.allowedApps = new Set(allowedApps);
  }

  check(pid: number, action: ActionType, app?: DetectedApp) {
    // Only allow approved applications
    if (app && !this.allowedApps.has(app.name)) {
      return { allowed: false, riskLevel: 'safe', reason: 'Application not approved' };
    }
    return super.check(pid, action, app);
  }
}
```

---

## Responsible Disclosure

### Reporting Security Issues

If you discover a security vulnerability in UAB, please report it responsibly:

1. **Do not** open a public GitHub issue
2. **Email:** security@your-org.com (replace with actual contact)
3. **Include:**
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact assessment
   - Suggested fix (if you have one)

### Response Timeline

| Stage | Timeline |
|-------|----------|
| Acknowledgment | Within 48 hours |
| Initial assessment | Within 5 business days |
| Fix development | Depends on severity |
| Coordinated disclosure | After fix is released |

### Severity Classification

| Severity | Description | Example |
|----------|-------------|---------|
| **Critical** | Remote code execution, privilege escalation | UAB bypasses session isolation |
| **High** | Data exfiltration, unauthorized app control | Audit log bypass |
| **Medium** | Rate limit bypass, permission misconfiguration | Race condition in permission check |
| **Low** | Information disclosure, minor DoS | Verbose error messages expose internals |

---

## API Key Authentication (v1.0.0)

UABServer now requires API key authentication for all POST endpoints.

- The API key is generated during installation and persisted locally
- All requests must include `X-API-Key: <key>` header
- GET /health is exempt (used for daemon health checks)
- The server binds to 0.0.0.0:3100 to allow VM access, but the API key prevents unauthorized use
- The key is stored at:
  - Windows: `%LOCALAPPDATA%\UAB Bridge\api-key`
  - macOS: `~/Library/Application Support/UAB Bridge/api-key`

---

## ELECTRON_ENABLE_REMOTE_DEBUGGING

The installer sets `ELECTRON_ENABLE_REMOTE_DEBUGGING=1` as a user environment variable. This enables CDP access to Electron apps for full DOM inspection. Security implications:
- Only affects apps launched by the current user
- CDP is bound to localhost only
- Required for deep UI inspection of Electron apps (ChatGPT, VS Code, Slack, etc.)

---

## Security Best Practices

When deploying UAB in production:

1. **Enable destructive action blocking** — `blockDestructive: true`
2. **Set conservative rate limits** — Start with 50/min, adjust up
3. **Configure audit logging** — Set `UAB_LOG_FILE` for persistent logs
4. **Restrict to known apps** — Use PID/name allowlists
5. **Monitor the audit trail** — Pipe to your SIEM
6. **Keep UAB updated** — Security fixes are released as patches
7. **Run with minimal privileges** — Don't run UAB as Administrator unless necessary
8. **Lock the desktop session** — UAB requires an interactive desktop session; ensure it's secured
