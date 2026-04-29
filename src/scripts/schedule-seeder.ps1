# Run once to register the daily seeder task in Windows Task Scheduler
# Usage: powershell -ExecutionPolicy Bypass -File src/scripts/schedule-seeder.ps1

$taskName = "TourIt-CourseSeeder"
$projectDir = "C:\Users\corey\tour-it"
$nodeExe = (Get-Command node).Source
$scriptPath = Join-Path $projectDir "src\scripts\seed-courses-v2.mjs"

Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

$action = New-ScheduledTaskAction -Execute $nodeExe -Argument "$scriptPath --popular" -WorkingDirectory $projectDir
$trigger = New-ScheduledTaskTrigger -Daily -At "7:00AM"
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Hours 2) -StartWhenAvailable -RunOnlyIfNetworkAvailable

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Tour It daily course seeder" -RunLevel Highest

Write-Host "Task registered — runs daily at 7:00 AM"
Write-Host "To run now: Start-ScheduledTask -TaskName TourIt-CourseSeeder"
