# ClawF Logs - Windows
# Usage: .\logs.ps1 [agent|dashboard] [-Follow]

param(
    [string]$Service = "agent",
    [switch]$Follow
)

$DataDir = $env:CLAWF_DATA_DIR ?? "$env:ProgramData\ClawFi"

$logFile = switch ($Service) {
    "agent" { "$DataDir\logs\clawfi.log" }
    "dashboard" { "$DataDir\logs\dashboard.log" }
    default { 
        Write-Host "Usage: .\logs.ps1 [agent|dashboard] [-Follow]"
        exit 1
    }
}

if (-not (Test-Path $logFile)) {
    Write-Host "Log file not found: $logFile" -ForegroundColor Red
    exit 1
}

if ($Follow) {
    Get-Content $logFile -Tail 50 -Wait
} else {
    Get-Content $logFile -Tail 100
}
