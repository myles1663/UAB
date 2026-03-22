Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$focused = [System.Windows.Automation.AutomationElement]::FocusedElement
if ($focused) {
  @{
    name = $focused.Current.Name
    controlType = $focused.Current.ControlType.ProgrammaticName
    className = $focused.Current.ClassName
    automationId = $focused.Current.AutomationId
    isEnabled = $focused.Current.IsEnabled
    pid = $focused.Current.ProcessId
    boundingRect = $focused.Current.BoundingRectangle.ToString()
  } | ConvertTo-Json -Compress
} else {
  @{ name = 'NONE' } | ConvertTo-Json -Compress
}
