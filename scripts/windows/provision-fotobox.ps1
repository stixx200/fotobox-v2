#Requires -Version 5.1
<#
.SYNOPSIS
  Sets up a freshly installed Windows PC as a Fotobox photo booth.

.DESCRIPTION
  Installs Fotobox in kiosk mode and configures everything the booth needs:
  computer name, time zone, "Höchstleistung" power plan, never sleep or turn
  off the screen, optional Wi-Fi and printer driver, photo/collage folders
  and the Fotobox settings (camera, printer, layouts, PINs, ...).

  Put this folder on the PC (USB stick, or deploy-remote.ps1 over SSH):
    provision-fotobox.ps1, FotoboxProvision.psm1
    fotobox-provision.psd1          (copy of fotobox-provision.example.psd1)
    Fotobox_<version>_x64-setup.exe

  Run it as administrator. It can be run again at any time, e.g. to apply
  changed settings or to update Fotobox with a newer setup. Restart Windows
  afterwards: the kiosk user then signs in and the booth starts.

  Log: %ProgramData%\Fotobox\provision.log

.PARAMETER ConfigPath
  Configuration (.psd1). Default: fotobox-provision.psd1 next to this script.
.PARAMETER SetupPath
  Fotobox setup. Default: the newest Fotobox_*-setup.exe next to this script.
.PARAMETER Restart
  Restart Windows when done.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\provision-fotobox.ps1 -Restart
#>
[CmdletBinding()]
param(
    [string]$ConfigPath,
    [string]$SetupPath,
    [switch]$Restart
)

$ErrorActionPreference = 'Stop'

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error 'Please run as administrator (right-click PowerShell > "Als Administrator ausführen").'
    exit 1
}

if (-not $ConfigPath) {
    $ConfigPath = Join-Path $PSScriptRoot 'fotobox-provision.psd1'
}
if (-not $SetupPath) {
    $SetupPath = Get-ChildItem -LiteralPath $PSScriptRoot -Filter 'Fotobox_*-setup.exe' |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
}

$programData = if ($env:ProgramData) { $env:ProgramData } else { 'C:\ProgramData' }
$logPath = Join-Path (Join-Path $programData 'Fotobox') 'provision.log'
New-Item -ItemType Directory -Path (Split-Path -Parent $logPath) -Force | Out-Null
Start-Transcript -LiteralPath $logPath -Append | Out-Null
$exitCode = 0
try {
    if (-not (Test-Path -LiteralPath $ConfigPath)) {
        throw "Configuration not found: $ConfigPath (copy fotobox-provision.example.psd1)"
    }
    if (-not $SetupPath -or -not (Test-Path -LiteralPath $SetupPath)) {
        throw "Fotobox setup (Fotobox_*-setup.exe) not found next to $PSCommandPath"
    }
    Import-Module (Join-Path $PSScriptRoot 'FotoboxProvision.psm1') -Force
    $config = Import-PowerShellDataFile -LiteralPath $ConfigPath
    $result = Invoke-FotoboxProvisioning -Config $config -SetupPath $SetupPath -BaseDir $PSScriptRoot
    Write-Output ''
    Write-Output 'Fotobox is set up.'
    Write-Output "  Kiosk user:  $($result.KioskUser) (signs in automatically)"
    Write-Output "  Installed:   $($result.InstallDir)"
    Write-Output "  Settings:    $($result.ProvisioningFile)"
    Write-Output '  Operator:    Ctrl+Alt+Del > "Benutzer wechseln" > administrator account'
    if ($Restart) {
        Write-Output 'Restarting Windows in 10 seconds...'
    }
    else {
        Write-Output 'Restart Windows to start the booth.'
    }
}
catch {
    Write-Error -Message "Fotobox provisioning failed: $($_.Exception.Message)" -ErrorAction Continue
    Write-Output $_.ScriptStackTrace
    $exitCode = 1
}
finally {
    Stop-Transcript | Out-Null
}

if ($exitCode -eq 0 -and $Restart) {
    # Delayed, so a remote session can still receive the output.
    & shutdown.exe /r /t 10 /c 'Fotobox: Neustart nach der Einrichtung' | Out-Null
}
exit $exitCode
