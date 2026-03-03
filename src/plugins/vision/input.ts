/**
 * Vision Input Injection — Coordinate-based mouse & keyboard via Win32 API
 *
 * Provides low-level input injection for the Vision fallback:
 *   - Mouse: click, double-click, right-click, hover at (x, y)
 *   - Keyboard: keypress, hotkey combos, text typing
 *   - Window: foreground management
 *
 * Uses PowerShell → C# P/Invoke to call user32.dll directly.
 * This works with ANY window regardless of framework or accessibility support.
 */

import { runPSJsonInteractive, runPSRawInteractive } from '../../ps-exec.js';
import type { ActionResult } from '../../types.js';

// ─── Mouse Actions ───────────────────────────────────────────

/**
 * Bring a window to foreground by PID before sending input.
 */
function foregroundScript(pid: number): string {
  return `
Add-Type -TypeDefinition '
  using System;
  using System.Runtime.InteropServices;
  public class VisionInput {
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool f);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int n);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint f, int dx, int dy, uint d, IntPtr e);
    [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte sc, uint f, IntPtr e);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    public static IntPtr FindByPid(int pid) {
      IntPtr found = IntPtr.Zero;
      EnumWindows((hWnd, _) => {
        uint wpid;
        GetWindowThreadProcessId(hWnd, out wpid);
        if ((int)wpid == pid) { found = hWnd; return false; }
        return true;
      }, IntPtr.Zero);
      return found;
    }

    public static bool ForceForeground(IntPtr target) {
      IntPtr fg = GetForegroundWindow();
      if (fg == target) return true;
      uint fgPid; uint fgT = GetWindowThreadProcessId(fg, out fgPid);
      uint curT = GetCurrentThreadId();
      keybd_event(0x12, 0, 0, IntPtr.Zero);
      keybd_event(0x12, 0, 0x02, IntPtr.Zero);
      if (fgT != curT) AttachThreadInput(curT, fgT, true);
      ShowWindow(target, 9);
      SetForegroundWindow(target);
      BringWindowToTop(target);
      if (fgT != curT) AttachThreadInput(curT, fgT, false);
      System.Threading.Thread.Sleep(100);
      return true;
    }

    public static void LeftClick(int x, int y) {
      SetCursorPos(x, y); System.Threading.Thread.Sleep(50);
      mouse_event(0x02, 0, 0, 0, IntPtr.Zero);
      mouse_event(0x04, 0, 0, 0, IntPtr.Zero);
    }

    public static void RightClick(int x, int y) {
      SetCursorPos(x, y); System.Threading.Thread.Sleep(50);
      mouse_event(0x08, 0, 0, 0, IntPtr.Zero);
      mouse_event(0x10, 0, 0, 0, IntPtr.Zero);
    }

    public static void DoubleClick(int x, int y) {
      SetCursorPos(x, y); System.Threading.Thread.Sleep(50);
      mouse_event(0x02, 0, 0, 0, IntPtr.Zero);
      mouse_event(0x04, 0, 0, 0, IntPtr.Zero);
      System.Threading.Thread.Sleep(50);
      mouse_event(0x02, 0, 0, 0, IntPtr.Zero);
      mouse_event(0x04, 0, 0, 0, IntPtr.Zero);
    }

    public static void MoveTo(int x, int y) {
      SetCursorPos(x, y);
      mouse_event(0x01, 0, 0, 0, IntPtr.Zero);
    }
  }
'

$hWnd = [VisionInput]::FindByPid(${pid})
if ($hWnd -ne [IntPtr]::Zero) {
  [VisionInput]::ForceForeground($hWnd) | Out-Null
}
`;
}

/**
 * Click at absolute screen coordinates.
 */
export function clickAt(pid: number, x: number, y: number): ActionResult {
  const script = `${foregroundScript(pid)}
[VisionInput]::LeftClick(${Math.round(x)}, ${Math.round(y)})
@{ success = $true } | ConvertTo-Json -Compress
`;
  try {
    return runPSJsonInteractive(script, 10000) as ActionResult;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Double-click at absolute screen coordinates.
 */
export function doubleClickAt(pid: number, x: number, y: number): ActionResult {
  const script = `${foregroundScript(pid)}
[VisionInput]::DoubleClick(${Math.round(x)}, ${Math.round(y)})
@{ success = $true } | ConvertTo-Json -Compress
`;
  try {
    return runPSJsonInteractive(script, 10000) as ActionResult;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Right-click at absolute screen coordinates.
 */
export function rightClickAt(pid: number, x: number, y: number): ActionResult {
  const script = `${foregroundScript(pid)}
[VisionInput]::RightClick(${Math.round(x)}, ${Math.round(y)})
@{ success = $true } | ConvertTo-Json -Compress
`;
  try {
    return runPSJsonInteractive(script, 10000) as ActionResult;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Hover (move cursor) to absolute screen coordinates.
 */
export function hoverAt(pid: number, x: number, y: number): ActionResult {
  const script = `${foregroundScript(pid)}
[VisionInput]::MoveTo(${Math.round(x)}, ${Math.round(y)})
@{ success = $true } | ConvertTo-Json -Compress
`;
  try {
    return runPSJsonInteractive(script, 10000) as ActionResult;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Keyboard Actions ────────────────────────────────────────

// SendKeys format mapping
const SENDKEYS_MAP: Record<string, string> = {
  backspace: '{BACKSPACE}', tab: '{TAB}', enter: '{ENTER}', return: '{ENTER}',
  escape: '{ESC}', esc: '{ESC}', space: ' ',
  pageup: '{PGUP}', pagedown: '{PGDN}',
  end: '{END}', home: '{HOME}',
  left: '{LEFT}', up: '{UP}', right: '{RIGHT}', down: '{DOWN}',
  insert: '{INSERT}', delete: '{DELETE}',
  f1: '{F1}', f2: '{F2}', f3: '{F3}', f4: '{F4}',
  f5: '{F5}', f6: '{F6}', f7: '{F7}', f8: '{F8}',
  f9: '{F9}', f10: '{F10}', f11: '{F11}', f12: '{F12}',
  '+': '{+}', '^': '{^}', '%': '{%}', '~': '{~}',
};

/**
 * Send a single keypress to the foreground window.
 */
export function sendKeypress(pid: number, key: string): ActionResult {
  const mapped = SENDKEYS_MAP[key.toLowerCase()] || key;
  const escaped = mapped.replace(/'/g, "''");
  const script = `${foregroundScript(pid)}
Add-Type -AssemblyName System.Windows.Forms
Start-Sleep -Milliseconds 100
[System.Windows.Forms.SendKeys]::SendWait('${escaped}')
@{ success = $true } | ConvertTo-Json -Compress
`;
  try {
    return runPSJsonInteractive(script, 10000) as ActionResult;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Send a hotkey combination (e.g., ['ctrl', 's']).
 */
export function sendHotkey(pid: number, keys: string[]): ActionResult {
  // Build SendKeys combo: ctrl=^, shift=+, alt=%
  let combo = '';
  const modifiers: string[] = [];
  let mainKey = '';

  for (const k of keys) {
    const lower = k.toLowerCase();
    if (lower === 'ctrl' || lower === 'control') modifiers.push('^');
    else if (lower === 'shift') modifiers.push('+');
    else if (lower === 'alt') modifiers.push('%');
    else mainKey = SENDKEYS_MAP[lower] || k;
  }

  combo = modifiers.join('') + mainKey;
  const escaped = combo.replace(/'/g, "''");

  const script = `${foregroundScript(pid)}
Add-Type -AssemblyName System.Windows.Forms
Start-Sleep -Milliseconds 100
[System.Windows.Forms.SendKeys]::SendWait('${escaped}')
@{ success = $true } | ConvertTo-Json -Compress
`;
  try {
    return runPSJsonInteractive(script, 10000) as ActionResult;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Type text into the currently focused element.
 * Clicks at coordinates first to ensure focus, then types.
 */
export function typeTextAt(pid: number, x: number, y: number, text: string): ActionResult {
  const escaped = text.replace(/'/g, "''")
    .replace(/\+/g, '{+}').replace(/\^/g, '{^}')
    .replace(/%/g, '{%}').replace(/~/g, '{~}')
    .replace(/\(/g, '{(}').replace(/\)/g, '{)}')
    .replace(/\{/g, '{{}').replace(/\}/g, '{}}');

  const script = `${foregroundScript(pid)}
Add-Type -AssemblyName System.Windows.Forms
[VisionInput]::LeftClick(${Math.round(x)}, ${Math.round(y)})
Start-Sleep -Milliseconds 200
[System.Windows.Forms.SendKeys]::SendWait('${escaped}')
@{ success = $true } | ConvertTo-Json -Compress
`;
  try {
    return runPSJsonInteractive(script, 15000) as ActionResult;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Window Actions ──────────────────────────────────────────

/**
 * Window management via Win32 API.
 */
export function windowAction(
  pid: number,
  action: 'minimize' | 'maximize' | 'restore' | 'close',
): ActionResult {
  const cmdMap: Record<string, string> = {
    minimize: 'ShowWindow($hWnd, 6)',
    maximize: 'ShowWindow($hWnd, 3)',
    restore: 'ShowWindow($hWnd, 9)',
    close: 'PostMessage($hWnd, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero)',
  };

  const cmd = cmdMap[action];
  if (!cmd) return { success: false, error: `Unknown window action: ${action}` };

  const script = `
Add-Type -TypeDefinition '
  using System;
  using System.Runtime.InteropServices;
  public class VWin {
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int n);
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    public static IntPtr FindByPid(int pid) {
      IntPtr found = IntPtr.Zero;
      EnumWindows((hWnd, _) => {
        uint wpid; GetWindowThreadProcessId(hWnd, out wpid);
        if ((int)wpid == pid) { found = hWnd; return false; }
        return true;
      }, IntPtr.Zero);
      return found;
    }
  }
'
$hWnd = [VWin]::FindByPid(${pid})
if ($hWnd -eq [IntPtr]::Zero) {
  @{ success = $false; error = 'Window not found' } | ConvertTo-Json -Compress
} else {
  [VWin]::${cmd} | Out-Null
  @{ success = $true } | ConvertTo-Json -Compress
}
`;
  try {
    return runPSJsonInteractive(script, 10000) as ActionResult;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ─── Screenshot Capture ──────────────────────────────────────

/**
 * Capture a screenshot of a window by PID.
 * Returns the file path and base64-encoded image data.
 */
export function captureScreenshot(
  pid: number,
  outputPath: string,
): { success: boolean; path?: string; base64?: string; width?: number; height?: number; error?: string } {
  const escapedPath = outputPath.replace(/\\/g, '\\\\').replace(/'/g, "''");

  const script = `
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$sdAssembly = [System.Drawing.Bitmap].Assembly.Location
Add-Type -ReferencedAssemblies $sdAssembly -TypeDefinition '
  using System;
  using System.Drawing;
  using System.Drawing.Imaging;
  using System.Runtime.InteropServices;
  using System.IO;
  public class VisionCapture {
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, int nFlags);
    [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

    public static string CaptureToFile(IntPtr hWnd, string path) {
      RECT rect;
      if (!GetWindowRect(hWnd, out rect)) return "ERR:GetWindowRect failed";
      int w = rect.Right - rect.Left;
      int h = rect.Bottom - rect.Top;
      if (w <= 0 || h <= 0) return "ERR:Zero size " + w + "x" + h;
      using (Bitmap bmp = new Bitmap(w, h)) {
        using (Graphics g = Graphics.FromImage(bmp)) {
          IntPtr hdc = g.GetHdc();
          bool ok = PrintWindow(hWnd, hdc, 2);
          g.ReleaseHdc(hdc);
          if (!ok) g.CopyFromScreen(rect.Left, rect.Top, 0, 0, new Size(w, h));
        }
        string dir = Path.GetDirectoryName(path);
        if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
          Directory.CreateDirectory(dir);
        bmp.Save(path, ImageFormat.Png);
      }
      return "OK:" + rect.Left + "," + rect.Top + "," + (rect.Right-rect.Left) + "," + (rect.Bottom-rect.Top);
    }

    public static string ToBase64(string path) {
      byte[] bytes = File.ReadAllBytes(path);
      return Convert.ToBase64String(bytes);
    }
  }
'

$rootEl = [System.Windows.Automation.AutomationElement]::RootElement
$procCond = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::ProcessIdProperty, ${pid}
)
$windows = $rootEl.FindAll([System.Windows.Automation.TreeScope]::Children, $procCond)

$bestWindow = $null
$bestArea = 0
foreach ($w in $windows) {
  $rect = $w.Current.BoundingRectangle
  $cls = $w.Current.ClassName
  $name = $w.Current.Name
  if (-not $rect.IsEmpty -and $rect.Width -gt 50 -and $rect.Height -gt 50) {
    if ($cls -eq 'Progman' -or $cls -eq 'Shell_TrayWnd' -or $cls -eq 'Shell_SecondaryTrayWnd') { continue }
    if ($name -eq 'Program Manager') { continue }
    if ($rect.Width / $rect.Height -gt 8) { continue }
    $area = $rect.Width * $rect.Height
    if ($area -gt $bestArea) { $bestArea = $area; $bestWindow = $w }
  }
}

if (-not $bestWindow) {
  @{ success = $false; error = 'No suitable window found' } | ConvertTo-Json -Compress
  exit
}

$nativeHandle = [IntPtr]$bestWindow.Current.NativeWindowHandle
if ($nativeHandle -eq [IntPtr]::Zero) {
  @{ success = $false; error = 'No native window handle' } | ConvertTo-Json -Compress
  exit
}

$result = [VisionCapture]::CaptureToFile($nativeHandle, '${escapedPath}')
if ($result.StartsWith('OK:')) {
  $dims = $result.Substring(3).Split(',')
  $b64 = [VisionCapture]::ToBase64('${escapedPath}')
  @{
    success = $true
    path = '${escapedPath}'
    base64 = $b64
    winX = [int]$dims[0]
    winY = [int]$dims[1]
    width = [int]$dims[2]
    height = [int]$dims[3]
  } | ConvertTo-Json -Compress
} else {
  @{ success = $false; error = $result } | ConvertTo-Json -Compress
}
`;

  try {
    const raw = runPSJsonInteractive(script, 20000) as {
      success: boolean;
      path?: string;
      base64?: string;
      winX?: number;
      winY?: number;
      width?: number;
      height?: number;
      error?: string;
    };

    if (raw.success) {
      return {
        success: true,
        path: raw.path,
        base64: raw.base64,
        width: raw.width,
        height: raw.height,
      };
    }
    return { success: false, error: raw.error };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Get window bounds (position + size) for a PID.
 */
export function getWindowBounds(pid: number): {
  success: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  title?: string;
  error?: string;
} {
  const script = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$rootEl = [System.Windows.Automation.AutomationElement]::RootElement
$procCond = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::ProcessIdProperty, ${pid}
)
$windows = $rootEl.FindAll([System.Windows.Automation.TreeScope]::Children, $procCond)

$bestWindow = $null
$bestArea = 0
foreach ($w in $windows) {
  $rect = $w.Current.BoundingRectangle
  $cls = $w.Current.ClassName
  $name = $w.Current.Name
  if (-not $rect.IsEmpty -and $rect.Width -gt 50 -and $rect.Height -gt 50) {
    if ($cls -eq 'Progman' -or $cls -eq 'Shell_TrayWnd') { continue }
    if ($name -eq 'Program Manager') { continue }
    if ($rect.Width / $rect.Height -gt 8) { continue }
    $area = $rect.Width * $rect.Height
    if ($area -gt $bestArea) { $bestArea = $area; $bestWindow = $w }
  }
}

if ($bestWindow) {
  $rect = $bestWindow.Current.BoundingRectangle
  @{
    success = $true
    x = [math]::Round($rect.X)
    y = [math]::Round($rect.Y)
    width = [math]::Round($rect.Width)
    height = [math]::Round($rect.Height)
    title = $bestWindow.Current.Name
  } | ConvertTo-Json -Compress
} else {
  @{ success = $false; error = 'No window found' } | ConvertTo-Json -Compress
}
`;

  try {
    return runPSJsonInteractive(script, 10000) as any;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
