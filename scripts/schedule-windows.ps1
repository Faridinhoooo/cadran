# Planifie l'actualisation automatique du catalogue sous Windows (aucune manipulation ensuite).
#  - chaque jour à 06:00 : prix (Apple, Samsung, Xiaomi, Google Store, flux configurés) + contrôle des pages vendeurs
#  - chaque lundi à 06:30 : fiches (endoflife.date, pages constructeurs, Open Icecat)
# Usage : powershell -ExecutionPolicy Bypass -File scripts\schedule-windows.ps1
# Suppression : Unregister-ScheduledTask -TaskName "Cadran - prix","Cadran - fiches" -Confirm:$false

$site = Split-Path -Parent $PSScriptRoot
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$log = Join-Path $site "data\import.log"

$prix = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c cd /d `"$site`" && `"$npm`" run refresh:offers >> `"$log`" 2>&1" -WorkingDirectory $site
$fiches = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c cd /d `"$site`" && `"$npm`" run import -- --only=eol,official >> `"$log`" 2>&1" -WorkingDirectory $site
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd -ExecutionTimeLimit (New-TimeSpan -Hours 1)

Register-ScheduledTask -TaskName "Cadran - prix" -Action $prix -Trigger (New-ScheduledTaskTrigger -Daily -At 6:00) -Settings $settings -Force | Out-Null
Register-ScheduledTask -TaskName "Cadran - fiches" -Action $fiches -Trigger (New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 6:30) -Settings $settings -Force | Out-Null
Write-Host "Tâches planifiées créées. Journal : $log"
