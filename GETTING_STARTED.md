# Getting Started

Step-by-step guide: install UAB, configure your environment, and control your first desktop application.

## Prerequisites

- **Node.js** >= 18.0.0
- **Windows 10/11** (primary platform)
- **PowerShell** 5.1+ (included with Windows)
- A desktop application to control (we'll use Notepad)

## Step 1: Install

```bash
npm install universal-app-bridge
```

Or clone the repo for development:

```bash
git clone https://github.com/myles1663/UAB.git
cd universal-app-bridge
npm install
npm run build
```

## Step 2: Verify Installation

Open a terminal and run:

```bash
node dist/uab/cli.js help
```

You should see a list of all available CLI commands. If you see an error, make sure you ran `npm run build` first.

## Step 3: Detect Running Apps

Open Notepad (or any application), then:

```bash
node dist/uab/cli.js detect
```

You'll get JSON output listing all controllable applications:

```json
{
  "success": true,
  "apps": [
    {
      "pid": 12340,
      "name": "notepad",
      "framework": "unknown",
      "confidence": 0.7,
      "windowTitle": "Untitled - Notepad"
    },
    {
      "pid": 5678,
      "name": "Code",
      "framework": "electron",
      "confidence": 0.9,
      "windowTitle": "project - Visual Studio Code"
    }
  ]
}
```

## Step 4: Connect to an App

Connect to Notepad by name or PID:

```bash
# By name (fuzzy match)
node dist/uab/cli.js connect notepad

# By PID (exact)
node dist/uab/cli.js connect 12340
```

Response:

```json
{
  "success": true,
  "pid": 12340,
  "name": "notepad",
  "method": "accessibility",
  "elementCount": 15
}
```

## Step 5: Explore the UI Tree

See what elements are available:

```bash
node dist/uab/cli.js enumerate 12340
```

This returns a flattened list of all UI elements with their IDs, types, and labels. Use `--depth 2` to limit tree depth.

## Step 6: Find Specific Elements

Search for elements by type and/or label:

```bash
# Find all buttons
node dist/uab/cli.js query 12340 --type button

# Find the text area
node dist/uab/cli.js query 12340 --type textarea

# Find by label
node dist/uab/cli.js query 12340 --label "File"
```

## Step 7: Take Action

Now interact with the app:

```bash
# Type text into the editor
node dist/uab/cli.js act 12340 <textareaId> type --text "Hello from UAB!"

# Send a keyboard shortcut
node dist/uab/cli.js hotkey 12340 ctrl+a   # Select all

# Take a screenshot
node dist/uab/cli.js screenshot 12340 --output notepad.png
```

Replace `<textareaId>` with the actual element ID from the enumerate/query results.

## Step 8: Window Management

Control the window itself:

```bash
node dist/uab/cli.js window 12340 maximize
node dist/uab/cli.js window 12340 minimize
node dist/uab/cli.js window 12340 restore
node dist/uab/cli.js window 12340 move --x 100 --y 100
node dist/uab/cli.js window 12340 resize --width 800 --height 600
```

## Step 9: Clean Up

```bash
# Disconnect from the app (app stays open)
# CLI is stateless, so this happens automatically
```

---

## Using UAB as a Library

For programmatic use in your own agent:

```typescript
import { uab } from 'universal-app-bridge';

async function main() {
  // Start the UAB service
  await uab.start();

  // Discover apps
  const apps = await uab.detect();
  console.log(`Found ${apps.length} controllable apps`);

  // Find and connect to Notepad
  const notepad = apps.find(a => a.name.toLowerCase().includes('notepad'));
  if (!notepad) {
    console.log('Notepad not found. Please open it first.');
    return;
  }

  await uab.connect(notepad);
  console.log(`Connected to ${notepad.name} (PID: ${notepad.pid})`);

  // Find the text area
  const textAreas = await uab.query(notepad.pid, { type: 'textarea' });
  if (textAreas.length > 0) {
    // Type into it
    await uab.act(notepad.pid, textAreas[0].id, 'type', { text: 'Hello from UAB!' });
    console.log('Typed text successfully');
  }

  // Get current state
  const state = await uab.state(notepad.pid);
  console.log('Window title:', state.window?.title);

  // Clean up
  await uab.stop();
}

main().catch(console.error);
```

---

## Using UAB with an AI Agent

UAB's CLI is designed for AI agent integration. The agent calls CLI commands via shell and parses JSON responses.

### Claude Code Integration

In your agent's system prompt or tool definition:

```
You have access to the Universal App Bridge (UAB) CLI for controlling desktop apps.

Usage: node dist/uab/cli.js <command>

Commands:
  detect              Scan for controllable applications
  connect <name|pid>  Connect to an application
  enumerate <pid>     List all UI elements
  query <pid>         Search for specific elements
  act <pid> <id> <action>  Perform an action
  state <pid>         Get application state
  keypress <pid> <key>     Send a keypress
  hotkey <pid> <keys>      Send a hotkey combination
  window <pid> <action>    Window management
  screenshot <pid>         Capture window screenshot

All output is JSON.
```

The agent can then autonomously:
1. Detect available apps
2. Connect to the right one
3. Navigate the UI tree
4. Perform actions
5. Verify results

---

## Environment Configuration

Create a `.env` file or set environment variables:

```bash
# Logging
UAB_LOG_LEVEL=info          # debug, info, warn, error
UAB_LOG_FILE=./uab.log      # Optional file logging

# Permission tuning
UAB_RATE_LIMIT=100          # Actions per minute per PID
UAB_BLOCK_DESTRUCTIVE=false # Block window close actions
```

---

## Troubleshooting

### "No apps detected"
- Make sure the target app is running and has a visible window
- Check that PowerShell can run: `powershell -Command "Get-Process"`
- System processes (services without windows) won't appear

### "Connection failed"
- For Electron apps: the app may need to be relaunched with `--remote-debugging-port=9222`
- For Office apps: make sure Office is fully loaded (not in splash screen)
- For any app: Win-UIA fallback should always work for windowed apps

### "Session 0" errors
- If running via SSH or as a Windows Service, UAB automatically bridges to the interactive session
- Make sure the desktop session is logged in and not locked

### Slow detection
- First scan takes 2-5 seconds (PowerShell startup + WMI query)
- Subsequent scans are faster due to process cache

---

## Next Steps

- [**API Reference**](API_REFERENCE.md) — Every method, parameter, and return type
- [**Supported Applications**](SUPPORTED_APPLICATIONS.md) — What's been tested and verified
- [**Architecture**](ARCHITECTURE.md) — How UAB works under the hood
- [**Examples**](examples/) — Working code samples
