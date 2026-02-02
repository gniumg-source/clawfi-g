# ClawF Status - Windows

$InstallDir = $env:CLAWF_INSTALL_DIR ?? "C:\Program Files\ClawFi"
$DataDir = $env:CLAWF_DATA_DIR ?? "$env:ProgramData\ClawFi"

Write-Host "`nClawF Status - Windows`n" -ForegroundColor Magenta

# Check services
Write-Host "Services:" -ForegroundColor Cyan
$nssm = Get-Command nssm -ErrorAction SilentlyContinue
if ($nssm) {
    $agentStatus = nssm status ClawFAgent 2>$null
    $dashStatus = nssm status ClawFDashboard 2>$null
    
    if ($agentStatus -match "Running") {
        Write-Host "  Agent:     Running" -ForegroundColor Green
    } else {
        Write-Host "  Agent:     Stopped" -ForegroundColor Red
    }
    
    if ($dashStatus -match "Running") {
        Write-Host "  Dashboard: Running" -ForegroundColor Green
    } else {
        Write-Host "  Dashboard: Stopped" -ForegroundColor Red
    }
} else {
    $agentTask = Get-ScheduledTask -TaskName "ClawFAgent" -ErrorAction SilentlyContinue
    $dashTask = Get-ScheduledTask -TaskName "ClawFDashboard" -ErrorAction SilentlyContinue
    
    Write-Host "  Agent:     $($agentTask.State ?? 'Not installed')"
    Write-Host "  Dashboard: $($dashTask.State ?? 'Not installed')"
}

# Health check
Write-Host "`nHealth:" -ForegroundColor Cyan
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3001/health" -TimeoutSec 5
    Write-Host "  API:       Healthy" -ForegroundColor Green
} catch {
    Write-Host "  API:       Unreachable" -ForegroundColor Red
}

# Version
if (Test-Path $InstallDir) {
    Set-Location $InstallDir
    $version = node -p "require('./apps/node/package.json').version" 2>$null
    Write-Host "`nVersion:   $version" -ForegroundColor Cyan
}

# URLs
$localIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" } | Select-Object -First 1).IPAddress ?? "localhost"
Write-Host "`nURLs:" -ForegroundColor Cyan
Write-Host "  Dashboard: http://${localIp}:3000"
Write-Host "  API:       http://${localIp}:3001"
Write-Host ""
