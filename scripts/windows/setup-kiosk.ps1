#Requires -Version 5.1
<#
.SYNOPSIS
  Advanced kiosk setup for the Fotobox Windows install.

.DESCRIPTION
  - Ensures a Startup-folder shortcut exists (fallback for open-at-login).
  - Prints guidance for auto-login and Windows Assigned Access.
  - Optionally opens the Windows firewall port for LAN QR sharing (API on 3000).

.PARAMETER Elevated
  When set, attempts firewall rule creation (requires admin).

.EXAMPLE
  .\setup-kiosk.ps1
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File setup-kiosk.ps1 -Elevated
#>
[CmdletBinding()]
param(
  [switch]$Elevated
)

$ErrorActionPreference = 'Stop'

function Write-Step([string]$Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Find-FotoboxExe {
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\fotobox-electron\Fotobox.exe'),
    (Join-Path $env:LOCALAPPDATA 'fotobox-electron\Fotobox.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Fotobox\Fotobox.exe')
  )

  foreach ($path in $candidates) {
    if (Test-Path -LiteralPath $path) {
      return $path
    }
  }

  $searchRoot = Join-Path $env:LOCALAPPDATA 'Programs'
  if (Test-Path $searchRoot) {
    $found = Get-ChildItem -Path $searchRoot -Filter 'Fotobox.exe' -Recurse -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($found) {
      return $found.FullName
    }
  }

  return $null
}

Write-Step 'Locating Fotobox installation'
$exePath = Find-FotoboxExe
if (-not $exePath) {
  Write-Host 'Could not find Fotobox.exe under %LOCALAPPDATA%. Install the MSI first.' -ForegroundColor Red
  exit 1
}
Write-Host "Found: $exePath" -ForegroundColor Green

Write-Step 'Creating Startup shortcut (login auto-start fallback)'
$startupDir = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupDir 'Fotobox.lnk'
$wsh = New-Object -ComObject WScript.Shell
$shortcut = $wsh.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $exePath
$shortcut.WorkingDirectory = Split-Path $exePath -Parent
$shortcut.Description = 'Fotobox photo booth kiosk'
$shortcut.Save()
Write-Host "Shortcut: $shortcutPath" -ForegroundColor Green

if ($Elevated) {
  Write-Step 'Configuring firewall for LAN API access (TCP 3000)'
  $ruleName = 'Fotobox API (TCP 3000)'
  $existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host 'Firewall rule already exists.' -ForegroundColor Yellow
  } else {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 | Out-Null
    Write-Host 'Firewall rule created.' -ForegroundColor Green
  }
} else {
  Write-Host 'Tip: re-run with -Elevated as Administrator to allow LAN QR sharing (port 3000).' -ForegroundColor Yellow
}

Write-Step 'Auto-login (optional, requires administrator)'
Write-Host @"
1. Press Win+R, type netplwiz, press Enter.
2. Uncheck 'Users must enter a user name and password'.
3. Select the kiosk user account and enter its password.
4. Reboot to verify unattended login.
"@

Write-Step 'Windows Assigned Access (full desktop lockdown)'
Write-Host @"
1. Settings -> Accounts -> Other users (or Family & other users).
2. Choose 'Set up a kiosk' / Assigned Access.
3. Select the kiosk user and choose 'Fotobox' (or fotobox-electron) as the allowed app.
4. Sign in with the kiosk account to verify single-app mode.

Note: Assigned Access requires Windows 10/11 Pro, Enterprise, or Education.
"@

$assignedAccessKey = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AssignedAccessConfiguration'
if (Test-Path $assignedAccessKey) {
  Write-Host 'Assigned Access registry key is present on this system.' -ForegroundColor Green
} else {
  Write-Host 'Assigned Access may not be available on this Windows edition.' -ForegroundColor Yellow
}

Write-Step 'Done'
Write-Host 'Basic kiosk startup is configured. Launch Fotobox once to complete in-app first-run setup.' -ForegroundColor Green
