param([int]$ProcessId)

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$rootEl = [System.Windows.Automation.AutomationElement]::RootElement
$procCond = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::ProcessIdProperty, $ProcessId
)

# Find the window
$win = $rootEl.FindFirst([System.Windows.Automation.TreeScope]::Children, $procCond)
if (-not $win) {
  @{ error = "Window not found for PID $ProcessId" } | ConvertTo-Json -Compress
  exit
}

# Find ALL elements in the entire tree
$allCond = [System.Windows.Automation.Condition]::TrueCondition
$allElements = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, $allCond)

$results = @()
foreach ($el in $allElements) {
  $name = $el.Current.Name
  $controlType = $el.Current.ControlType.ProgrammaticName
  $automationId = $el.Current.AutomationId

  # Get supported patterns (actions)
  $patterns = @()
  try {
    $supported = $el.GetSupportedPatterns()
    foreach ($p in $supported) {
      $patterns += $p.ProgrammaticName
    }
  } catch {}

  # Only include elements with a name or automation ID
  if ($name -or $automationId) {
    $results += @{
      name = $name
      controlType = $controlType
      automationId = $automationId
      patterns = ($patterns -join ',')
      className = $el.Current.ClassName
    }
  }
}

$results | ConvertTo-Json -Compress
