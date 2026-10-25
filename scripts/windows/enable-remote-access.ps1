#Requires -Version 5.1
<#
.SYNOPSIS
  Prepares a fresh Windows PC for remote setup over SSH (run once, locally).

.DESCRIPTION
  Enables the Windows OpenSSH server, opens port 22 for the local network,
  makes Windows PowerShell the SSH shell and optionally authorizes your SSH
  public key for administrators. Afterwards run deploy-remote.ps1 on your
  Mac/PC to install and configure the Fotobox over the network.

  Run as administrator, e.g. from a USB stick:
    powershell -ExecutionPolicy Bypass -File E:\enable-remote-access.ps1 -PublicKey 'ssh-ed25519 AAAA... you@mac'

.PARAMETER PublicKey
  Your SSH public key (content of ~/.ssh/id_ed25519.pub). Without it, sign in
  with the password of an administrator account.
.PARAMETER Disable
  Turn remote access off again (stops and disables the SSH server).
#>
[CmdletBinding()]
param(
    [string]$PublicKey,
    [switch]$Disable
)

$ErrorActionPreference = 'Stop'

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error 'Please run as administrator (right-click PowerShell > "Als Administrator ausführen").'
    exit 1
}

if ($Disable) {
    Stop-Service sshd -ErrorAction SilentlyContinue
    Set-Service sshd -StartupType Disabled -ErrorAction SilentlyContinue
    Remove-NetFirewallRule -Name 'Fotobox-SSH' -ErrorAction SilentlyContinue
    Write-Output 'SSH remote access is off.'
    exit 0
}

# Same steps as provision-fotobox.ps1 (installs the OpenSSH server if missing).
Import-Module (Join-Path $PSScriptRoot 'FotoboxProvision.psm1') -Force
Enable-SshRemoteAccess -PublicKey $PublicKey

$addresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object -ExpandProperty IPAddress
Write-Output ''
Write-Output 'SSH remote access is on.'
Write-Output "  Computer:  $env:COMPUTERNAME"
Write-Output "  Addresses: $($addresses -join ', ')"
Write-Output "  User:      $env:USERNAME (administrator)"
Write-Output "Next, on your Mac: pwsh scripts/windows/deploy-remote.ps1 -ComputerName $($addresses | Select-Object -First 1) -User $env:USERNAME"
