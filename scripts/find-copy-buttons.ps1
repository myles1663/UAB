Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$rootEl = [System.Windows.Automation.AutomationElement]::RootElement
$procCond = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::ProcessIdProperty, 18604
)

$win = $rootEl.FindFirst([System.Windows.Automation.TreeScope]::Children, $procCond)
if (-not $win) { Write-Output "NOT FOUND"; exit }

# Search for elements named "Copy"
$nameCond = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::NameProperty, "Copy"
)
$copyElements = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, $nameCond)

Write-Output "Found $($copyElements.Count) Copy elements"

foreach ($el in $copyElements) {
  $rect = $el.Current.BoundingRectangle
  $hasInvoke = $false
  try {
    $el.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern) | Out-Null
    $hasInvoke = $true
  } catch {}

  Write-Output "  Name=$($el.Current.Name) Type=$($el.Current.ControlType.ProgrammaticName) Invoke=$hasInvoke Rect=$($rect.X),$($rect.Y),$($rect.Width),$($rect.Height)"
}

# Also search for Regenerate to confirm we're finding response action buttons
$regenCond = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::NameProperty, "Regenerate"
)
$regenElements = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, $regenCond)
Write-Output "Found $($regenElements.Count) Regenerate elements"
