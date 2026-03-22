Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms

$rootEl = [System.Windows.Automation.AutomationElement]::RootElement
$procCond = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::ProcessIdProperty, 18604
)

$win = $rootEl.FindFirst([System.Windows.Automation.TreeScope]::Children, $procCond)
if (-not $win) { Write-Output '{"success":false,"error":"not found"}'; exit }

$nameCond = New-Object System.Windows.Automation.PropertyCondition(
  [System.Windows.Automation.AutomationElement]::NameProperty, "Copy"
)
$copyElements = $win.FindAll([System.Windows.Automation.TreeScope]::Descendants, $nameCond)

if ($copyElements.Count -eq 0) {
  Write-Output '{"success":false,"error":"no copy buttons found"}'
  exit
}

# Get the LAST copy button (highest Y coordinate = last message)
$lastCopy = $null
$maxY = -999999
foreach ($el in $copyElements) {
  $y = $el.Current.BoundingRectangle.Y
  if ($y -gt $maxY) {
    $maxY = $y
    $lastCopy = $el
  }
}

# Invoke it
$invokePattern = $lastCopy.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
$invokePattern.Invoke()

Start-Sleep -Milliseconds 500

# Read clipboard
$text = [System.Windows.Forms.Clipboard]::GetText()
Write-Output "COPIED:$($text.Length)"
Write-Output $text
