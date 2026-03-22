Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$rootEl = [System.Windows.Automation.AutomationElement]::RootElement
$procCond = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::ProcessIdProperty, 18604
)

$win = $rootEl.FindFirst([System.Windows.Automation.TreeScope]::Children, $procCond)
if (-not $win) {
  Write-Output '{"error":"not found"}'
  exit
}

$allCond = [System.Windows.Automation.Condition]::TrueCondition
$allElements = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, $allCond)

$results = @()
foreach ($el in $allElements) {
  $name = $el.Current.Name
  $controlType = $el.Current.ControlType.ProgrammaticName
  $automationId = $el.Current.AutomationId
  $patterns = @()
  try {
    $supported = $el.GetSupportedPatterns()
    foreach ($p in $supported) { $patterns += $p.ProgrammaticName }
  } catch {}

  if ($name -or $automationId) {
    $results += @{
      name = $name
      type = $controlType
      id = $automationId
      patterns = ($patterns -join ',')
    }
  }
}

$results | ConvertTo-Json -Compress
