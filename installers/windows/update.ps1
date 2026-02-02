#Requires -RunAsAdministrator
# ClawF Updater - Windows

$ErrorActionPreference = "Stop"
$InstallDir = $env:CLAWF_INSTALL_DIR ?? "C:\Program Files\ClawFi"
$DataDir = $env:CLAWF_DATA_DIR ?? "$env:ProgramData\ClawFi"

Write-Host "`nClawF Updater - Windows`n" -ForegroundColor Cyan

# Backup
Write-Host "[INFO] Creating backup..." -ForegroundColor Cyan
$backupFile = "$DataDir\backups\pre-update-$(Get-Date -Format 'yyyyMMdd-HHmmss').zip"
Compress-Archive -Path "$DataDir\*" -DestinationPath $backupFile -Force
Write-Host "[OK] Backup: $backupFile" -ForegroundColor Green

# Stop services
Write-Host "[INFO] Stopping services..." -ForegroundColor Cyan
$nssm = Get-Command nssm -ErrorAction SilentlyContinue
if ($nssm) {
    nssm stop ClawFAgent 2>$null
    nssm stop ClawFDashboard 2>$null
} else {
    Stop-ScheduledTask -TaskName "ClawFAgent" -ErrorAction SilentlyContinue
    Stop-ScheduledTask -TaskName "ClawFDashboard" -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 2

# Pull updates
Write-Host "[INFO] Pulling updates..." -ForegroundColor Cyan
Set-Location $InstallDir
git pull origin main
Write-Host "[OK] Source updated" -ForegroundColor Green

# Rebuild
Write-Host "[INFO] Rebuilding..." -ForegroundColor Cyan
pnpm install
pnpm build
Write-Host "[OK] Build complete" -ForegroundColor Green

# Start services
Write-Host "[INFO] Starting services..." -ForegroundColor Cyan
if ($nssm) {
    nssm start ClawFAgent
    nssm start ClawFDashboard
} else {
    Start-ScheduledTask -TaskName "ClawFAgent"
    Start-ScheduledTask -TaskName "ClawFDashboard"
}

$version = node -p "require('./apps/node/package.json').version"
Write-Host "`n[OK] Update complete! Version: $version" -ForegroundColor Green
