#Requires -Version 5.1
<#
.SYNOPSIS
  Sets up this PC for Fotobox: kiosk mode (booth starts automatically after
  Windows starts) or a normal install. Also undoes the setup.

.DESCRIPTION
  Called by the Fotobox installer; can also be run manually as administrator
  (Start menu: "Fotobox Kiosk einrichten" / "Kiosk deaktivieren").

  Kiosk mode creates a standard user (default "Fotobox") that signs in
  automatically and starts the booth, restarts it if it exits, keeps the PC
  awake and blocks common ways out of the app. Restart Windows afterwards.

  To get to the Windows desktop as operator: press Ctrl+Alt+Del, choose
  "Switch user" and sign in with an administrator account.

  Log: %ProgramData%\Fotobox\setup.log

.PARAMETER Mode
  Kiosk (default) or Normal. Normal removes kiosk settings applied earlier.
.PARAMETER Uninstall
  Remove everything this script configured (keeps the kiosk user and photos
  unless -RemoveKioskUser is given).
.PARAMETER LanToken
  Tablet mode: 'none' (default), 'auto' to generate a token, or a token.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File setup-kiosk.ps1 -Mode Kiosk
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File setup-kiosk.ps1 -Mode Normal
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File setup-kiosk.ps1 -Uninstall -RemoveKioskUser
#>
[CmdletBinding()]
param(
    [ValidateSet('Kiosk', 'Normal')][string]$Mode = 'Kiosk',
    [switch]$Uninstall,
    [string]$InstallDir,
    [string]$KioskUser = 'Fotobox',
    [string]$LanToken = 'none',
    [ValidateRange(1, 65535)][int]$Port = 3000,
    [switch]$RemoveKioskUser,
    [string]$LogPath
)

$ErrorActionPreference = 'Stop'

# Started from the Start menu without admin rights: ask for elevation (UAC)
# and run again with the same parameters.
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $arguments = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$PSCommandPath`"")
    foreach ($entry in $PSBoundParameters.GetEnumerator()) {
        if ($entry.Value -is [switch]) {
            if ($entry.Value) { $arguments += "-$($entry.Key)" }
        }
        else {
            $arguments += "-$($entry.Key)", "`"$($entry.Value)`""
        }
    }
    $process = Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -Verb RunAs -Wait -PassThru
    exit $process.ExitCode
}

if (-not $LogPath) {
    $LogPath = Join-Path (Join-Path $env:ProgramData 'Fotobox') 'setup.log'
}
if (-not $InstallDir) {
    # The script is installed next to Fotobox.exe.
    $InstallDir = $PSScriptRoot
    if (-not (Test-Path -LiteralPath (Join-Path $InstallDir 'Fotobox.exe'))) {
        $InstallDir = Split-Path -Parent $PSScriptRoot
    }
}

New-Item -ItemType Directory -Path (Split-Path -Parent $LogPath) -Force | Out-Null
Start-Transcript -LiteralPath $LogPath -Append | Out-Null
$exitCode = 0
try {
    Import-Module (Join-Path $PSScriptRoot 'FotoboxKiosk.psm1') -Force
    if ($Uninstall) {
        Uninstall-FotoboxKiosk -RemoveKioskUser:$RemoveKioskUser
    }
    else {
        $result = Install-FotoboxKiosk -Mode $Mode -InstallDir $InstallDir -KioskUser $KioskUser -LanToken $LanToken -Port $Port
        if ($result.LanToken) {
            Write-Output "Tablet mode token: $($result.LanToken) (also in %ProgramData%\Fotobox\host.json)"
        }
    }
}
catch {
    Write-Error -Message "Fotobox setup failed: $($_.Exception.Message)" -ErrorAction Continue
    Write-Output $_.ScriptStackTrace
    $exitCode = 1
}
finally {
    Stop-Transcript | Out-Null
}
exit $exitCode
