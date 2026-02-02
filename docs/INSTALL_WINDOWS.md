# ClawF on Windows

**Your AI trading agent running 24/7 on Windows.**

ClawF runs as a Windows service, automatically starting with your PC.

## Requirements

- Windows 10/11 (64-bit)
- 8GB+ RAM
- 50GB+ free storage
- PowerShell 5.1+ (included in Windows 10/11)
- Administrator access

## Quick Install

Open PowerShell **as Administrator** and run:

```powershell
iwr https://raw.githubusercontent.com/ClawFiAI/clawfi/main/installers/windows/install.ps1 -UseBasicParsing | iex
```

The installer will:
1. Install Node.js and Git
2. Clone and build ClawF
3. Configure Windows services or scheduled tasks
4. Generate secure credentials
5. Start ClawF

## Post-Installation

```
Dashboard:     http://localhost:3000
Agent API:     http://localhost:3001
Health Check:  http://localhost:3001/health
```

## Configuration

Configuration is stored in `C:\ProgramData\ClawFi\.env`.

Edit with:
```powershell
notepad C:\ProgramData\ClawFi\.env
```

## Commands (PowerShell as Admin)

### Status
```powershell
C:\Program Files\ClawFi\installers\windows\status.ps1
```

### Logs
```powershell
# View agent logs
Get-Content C:\ProgramData\ClawFi\logs\clawfi.log -Tail 50

# Follow logs
Get-Content C:\ProgramData\ClawFi\logs\clawfi.log -Tail 50 -Wait
```

### Update
```powershell
C:\Program Files\ClawFi\installers\windows\update.ps1
```

## Data Location

- `C:\Program Files\ClawFi\` - Application files
- `C:\ProgramData\ClawFi\` - Data and configuration

## Uninstall

```powershell
# Keep data
C:\Program Files\ClawFi\installers\windows\uninstall.ps1

# Remove everything
C:\Program Files\ClawFi\installers\windows\uninstall.ps1 -Purge
```

## Better Service Support

For production use, install [NSSM](https://nssm.cc/):

```powershell
winget install nssm
```

Then reinstall ClawF for proper Windows service support.

---

**ClawF runs on your Windows PC 24/7. Your machine. Your rules.**
