#Requires -RunAsAdministrator
# ClawF Uninstaller - Windows
# Usage: .\uninstall.ps1 [-Purge]

param([switch]$Purge)

$InstallDir = $env:CLAWF_INSTALL_DIR ?? "C:\Program Files\ClawFi"
$DataDir = $env:CLAWF_DATA_DIR ?? "$env:ProgramData\ClawFi"

Write-Host "`nClawF Uninstaller" -ForegroundColor Red
if ($Purge) { Write-Host "WARNING: -Purge will delete ALL data" -ForegroundColor Red }

$confirm = Read-Host "Uninstall ClawF? [y/N]"
if ($confirm -ne 'y') { exit 0 }

# Stop and remove services
$nssm = Get-Command nssm -ErrorAction SilentlyContinue
if ($nssm) {
    nssm stop ClawFAgent 2>$null
    nssm stop ClawFDashboard 2>$null
    nssm remove ClawFAgent confirm 2>$null
    nssm remove ClawFDashboard confirm 2>$null
} else {
    Unregister-ScheduledTask -TaskName "ClawFAgent" -Confirm:$false -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName "ClawFDashboard" -Confirm:$false -ErrorAction SilentlyContinue
}

# Remove installation
Remove-Item -Recurse -Force $InstallDir -ErrorAction SilentlyContinue

# Remove data if purge
if ($Purge) {
    Remove-Item -Recurse -Force $DataDir -ErrorAction SilentlyContinue
    Write-Host "[OK] All data removed" -ForegroundColor Green
} else {
    Write-Host "Data preserved at: $DataDir" -ForegroundColor Yellow
}

Write-Host "[OK] ClawF uninstalled" -ForegroundColor Green
