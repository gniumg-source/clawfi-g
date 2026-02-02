#Requires -RunAsAdministrator
<#
.SYNOPSIS
    ClawF Appliance Installer - Windows

.DESCRIPTION
    Installs ClawF as a Windows service with auto-start capability.
    ClawF runs on your Windows machine 24/7. Your machine. Your rules.

.EXAMPLE
    iwr https://raw.githubusercontent.com/ClawFiAI/clawfi/main/installers/windows/install.ps1 -UseBasicParsing | iex
#>

$ErrorActionPreference = "Stop"

# Configuration
$InstallDir = $env:CLAWF_INSTALL_DIR ?? "C:\Program Files\ClawFi"
$DataDir = $env:CLAWF_DATA_DIR ?? "$env:ProgramData\ClawFi"
$RepoUrl = "https://github.com/ClawFiAI/clawfi.git"
$NodeVersion = "20"

# Colors
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) { Write-Output $args }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Banner {
    Write-Host ""
    Write-Host "  ClawF Appliance Installer - Windows" -ForegroundColor Magenta
    Write-Host "  =====================================" -ForegroundColor Magenta
    Write-Host ""
}

function Write-Info($msg) { Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Success($msg) { Write-Host "[OK] $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { Write-Host "[ERROR] $msg" -ForegroundColor Red }

# Check admin
function Test-Admin {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Install Node.js
function Install-NodeJS {
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
    if ($nodeCmd) {
        $version = (node -v).TrimStart('v').Split('.')[0]
        if ([int]$version -ge $NodeVersion) {
            Write-Success "Node.js v$(node -v) already installed"
            return
        }
    }
    
    Write-Info "Installing Node.js $NodeVersion..."
    
    # Download and install Node.js
    $arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
    $nodeUrl = "https://nodejs.org/dist/v$NodeVersion.0.0/node-v$NodeVersion.0.0-$arch.msi"
    $installerPath = "$env:TEMP\node-installer.msi"
    
    Invoke-WebRequest -Uri $nodeUrl -OutFile $installerPath -UseBasicParsing
    Start-Process msiexec.exe -Wait -ArgumentList "/i `"$installerPath`" /qn"
    Remove-Item $installerPath -Force
    
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    
    Write-Success "Node.js installed"
}

# Install pnpm
function Install-Pnpm {
    $pnpmCmd = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($pnpmCmd) {
        Write-Success "pnpm already installed"
        return
    }
    
    Write-Info "Installing pnpm..."
    npm install -g pnpm@latest
    Write-Success "pnpm installed"
}

# Install Git
function Install-Git {
    $gitCmd = Get-Command git -ErrorAction SilentlyContinue
    if ($gitCmd) {
        Write-Success "Git already installed"
        return
    }
    
    Write-Info "Installing Git..."
    
    # Use winget if available
    $winget = Get-Command winget -ErrorAction SilentlyContinue
    if ($winget) {
        winget install --id Git.Git -e --silent
    } else {
        Write-Err "Please install Git manually from https://git-scm.com"
        exit 1
    }
    
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
    
    Write-Success "Git installed"
}

# Create directories
function New-Directories {
    Write-Info "Creating directories..."
    
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    New-Item -ItemType Directory -Force -Path "$DataDir\logs" | Out-Null
    New-Item -ItemType Directory -Force -Path "$DataDir\db" | Out-Null
    New-Item -ItemType Directory -Force -Path "$DataDir\cache" | Out-Null
    New-Item -ItemType Directory -Force -Path "$DataDir\backups" | Out-Null
    
    Write-Success "Directories created"
}

# Clone repository
function Get-Repository {
    if (Test-Path "$InstallDir\.git") {
        Write-Info "Updating existing installation..."
        Set-Location $InstallDir
        git pull origin main
    } else {
        Write-Info "Cloning repository..."
        if (Test-Path $InstallDir) {
            Remove-Item -Recurse -Force $InstallDir
        }
        git clone --depth 1 $RepoUrl $InstallDir
        Set-Location $InstallDir
    }
    Write-Success "Source ready"
}

# Install npm packages
function Install-Packages {
    Write-Info "Installing npm packages..."
    Set-Location $InstallDir
    pnpm install
    Write-Success "Packages installed"
}

# Build project
function Build-Project {
    Write-Info "Building ClawF..."
    Set-Location $InstallDir
    pnpm build
    Write-Success "Build complete"
}

# Generate secrets
function New-Secrets {
    Write-Info "Generating secrets..."
    
    $masterKey = -join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
    $jwtSecret = -join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
    
    Set-Content -Path "$DataDir\.master_key" -Value $masterKey
    
    Write-Success "Secrets generated"
    
    return @{
        MasterKey = $masterKey
        JwtSecret = $jwtSecret
    }
}

# Create environment file
function New-EnvFile {
    $envFile = "$DataDir\.env"
    
    if (Test-Path $envFile) {
        Write-Warn "Environment file exists, preserving..."
        return
    }
    
    Write-Info "Creating environment file..."
    
    $masterKey = Get-Content "$DataDir\.master_key" -ErrorAction SilentlyContinue
    if (-not $masterKey) {
        $secrets = New-Secrets
        $masterKey = $secrets.MasterKey
    }
    $jwtSecret = -join ((48..57) + (97..102) | Get-Random -Count 64 | ForEach-Object { [char]$_ })
    
    $envContent = @"
# ClawF Configuration - Windows
# Generated on $(Get-Date)

NODE_ENV=production
PORT=3001
HOST=0.0.0.0

JWT_SECRET=$jwtSecret
MASTER_KEY=$masterKey

DATA_DIR=$DataDir
LOG_DIR=$DataDir\logs
DATABASE_URL=file:$DataDir\db\clawfi.db
CACHE_DIR=$DataDir\cache

DASHBOARD_PORT=3000

INFERENCE_PROVIDER=local

KILL_SWITCH_ENABLED=true
KILL_SWITCH_DEFAULT=false

LOG_LEVEL=info
LOG_REDACT_SECRETS=true
"@
    
    Set-Content -Path $envFile -Value $envContent
    Write-Success "Environment file created"
}

# Install as Windows Service using NSSM or Task Scheduler
function Install-Service {
    Write-Info "Setting up auto-start..."
    
    # Try NSSM first (better for services)
    $nssm = Get-Command nssm -ErrorAction SilentlyContinue
    
    if ($nssm) {
        # Use NSSM for proper Windows service
        Write-Info "Using NSSM for service installation..."
        
        # Stop existing services
        nssm stop ClawFAgent 2>$null
        nssm stop ClawFDashboard 2>$null
        nssm remove ClawFAgent confirm 2>$null
        nssm remove ClawFDashboard confirm 2>$null
        
        # Install agent service
        nssm install ClawFAgent node "$InstallDir\apps\node\dist\index.js"
        nssm set ClawFAgent AppDirectory $InstallDir
        nssm set ClawFAgent AppEnvironmentExtra "NODE_ENV=production" "DATA_DIR=$DataDir"
        nssm set ClawFAgent AppStdout "$DataDir\logs\clawfi.log"
        nssm set ClawFAgent AppStderr "$DataDir\logs\clawfi.error.log"
        nssm set ClawFAgent AppRotateFiles 1
        nssm set ClawFAgent Start SERVICE_AUTO_START
        
        # Install dashboard service
        nssm install ClawFDashboard node "$InstallDir\apps\dashboard-new\dist\server\entry.mjs"
        nssm set ClawFDashboard AppDirectory "$InstallDir\apps\dashboard-new"
        nssm set ClawFDashboard AppEnvironmentExtra "NODE_ENV=production" "PORT=3000"
        nssm set ClawFDashboard AppStdout "$DataDir\logs\dashboard.log"
        nssm set ClawFDashboard AppStderr "$DataDir\logs\dashboard.error.log"
        nssm set ClawFDashboard Start SERVICE_AUTO_START
        
        # Start services
        nssm start ClawFAgent
        nssm start ClawFDashboard
    } else {
        # Fallback to Task Scheduler
        Write-Info "Using Task Scheduler (install NSSM for better service support)..."
        
        # Remove existing tasks
        Unregister-ScheduledTask -TaskName "ClawFAgent" -Confirm:$false -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName "ClawFDashboard" -Confirm:$false -ErrorAction SilentlyContinue
        
        # Create agent task
        $agentAction = New-ScheduledTaskAction -Execute "node" -Argument "$InstallDir\apps\node\dist\index.js" -WorkingDirectory $InstallDir
        $agentTrigger = New-ScheduledTaskTrigger -AtStartup
        $agentSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
        Register-ScheduledTask -TaskName "ClawFAgent" -Action $agentAction -Trigger $agentTrigger -Settings $agentSettings -RunLevel Highest -Force
        
        # Create dashboard task
        $dashAction = New-ScheduledTaskAction -Execute "node" -Argument "$InstallDir\apps\dashboard-new\dist\server\entry.mjs" -WorkingDirectory "$InstallDir\apps\dashboard-new"
        Register-ScheduledTask -TaskName "ClawFDashboard" -Action $dashAction -Trigger $agentTrigger -Settings $agentSettings -RunLevel Highest -Force
        
        # Start tasks
        Start-ScheduledTask -TaskName "ClawFAgent"
        Start-ScheduledTask -TaskName "ClawFDashboard"
    }
    
    Write-Success "Auto-start configured"
}

# Print success message
function Write-SuccessMessage {
    $localIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" } | Select-Object -First 1).IPAddress ?? "localhost"
    
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Green
    Write-Host "  ClawF Installation Complete!" -ForegroundColor Green
    Write-Host "================================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Dashboard:     http://${localIp}:3000" -ForegroundColor Cyan
    Write-Host "  Agent API:     http://${localIp}:3001" -ForegroundColor Cyan
    Write-Host "  Health Check:  http://${localIp}:3001/health" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Commands:" -ForegroundColor Yellow
    Write-Host "    View logs:   Get-Content `"$DataDir\logs\clawfi.log`" -Tail 50" -ForegroundColor Gray
    Write-Host "    Status:      $InstallDir\installers\windows\status.ps1" -ForegroundColor Gray
    Write-Host "    Update:      $InstallDir\installers\windows\update.ps1" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  Data Dir:      $DataDir" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Green
    Write-Host "  ClawF runs on your Windows 24/7. Your machine. Your rules." -ForegroundColor Magenta
    Write-Host "================================================================" -ForegroundColor Green
    Write-Host ""
}

# Main installation
function Main {
    Write-Banner
    
    if (-not (Test-Admin)) {
        Write-Err "Please run as Administrator"
        exit 1
    }
    
    Write-Info "Starting ClawF installation..."
    
    Install-Git
    Install-NodeJS
    Install-Pnpm
    New-Directories
    Get-Repository
    Install-Packages
    Build-Project
    New-Secrets
    New-EnvFile
    Install-Service
    
    Start-Sleep -Seconds 3
    Write-SuccessMessage
}

Main
