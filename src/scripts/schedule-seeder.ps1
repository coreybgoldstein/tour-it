# Run once to register the daily seeder task in Windows Task Scheduler
# Usage: Right-click this file → "Run with PowerShell" (or run from an admin terminal)

$taskName = "TourIt-CourseSeeder"
$projectDir = "C:\Users\corey\tour-it"
$nodeExe = (Get-Command node).Source
$scriptPath = "$projectDir\src\scripts\seed-courses-v2.mjs"
$logFile = "$projectDir\seeder.log"

# Remove existing task if present
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction `
  -Execute $nodeExe `
  -Argument "$scriptPath --popular" `
  -WorkingDirectory $projectDir

# Run daily at 7:00 AM
$trigger = New-ScheduledTaskTrigger -Daily -At "7:00AM"

$settings = New-ScheduledTaskSettingsSet `
  -ExecutionTimeLimit (New-TimeSpan -Hours 2) `
  -StartWhenAvailable `
  -RunOnlyIfNetworkAvailable

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Description "Tour It: seeds 300 popular golf courses per day and emails a report" `
  -RunLevel Highest

Write-Host ""
Write-Host "✅ Task '$taskName' registered — runs daily at 7:00 AM" -ForegroundColor Green
Write-Host "   Logs: $logFile"
Write-Host ""
Write-Host "To run it right now:" -ForegroundColor Yellow
Write-Host "   Start-ScheduledTask -TaskName '$taskName'"
