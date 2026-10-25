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

$firewallRule = 'Fotobox-SSH'

if ($Disable) {
    Stop-Service sshd -ErrorAction SilentlyContinue
    Set-Service sshd -StartupType Disabled -ErrorAction SilentlyContinue
    Remove-NetFirewallRule -Name $firewallRule -ErrorAction SilentlyContinue
    Write-Output 'SSH remote access is off.'
    exit 0
}

# 1. OpenSSH server (a Windows feature; downloaded via Windows Update if needed)
$capability = Get-WindowsCapability -Online -Name 'OpenSSH.Server*' | Select-Object -First 1
if ($capability.State -ne 'Installed') {
    Write-Output "Installing $($capability.Name) (needs internet)..."
    Add-WindowsCapability -Online -Name $capability.Name | Out-Null
}
Set-Service sshd -StartupType Automatic
Start-Service sshd

# 2. Port 22 for the local network only (any network profile: a fresh
#    install often marks the network as public).
Remove-NetFirewallRule -Name $firewallRule -ErrorAction SilentlyContinue
New-NetFirewallRule -Name $firewallRule -DisplayName 'Fotobox remote setup (SSH)' -Direction Inbound `
    -Protocol TCP -LocalPort 22 -RemoteAddress LocalSubnet -Profile Any -Action Allow | Out-Null

# 3. Windows PowerShell as the SSH shell (deploy-remote.ps1 relies on it).
$shell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
New-Item -Path 'HKLM:\SOFTWARE\OpenSSH' -Force | Out-Null
New-ItemProperty -Path 'HKLM:\SOFTWARE\OpenSSH' -Name DefaultShell -Value $shell -PropertyType String -Force | Out-Null

# 4. Key login for administrators (file must be owned by Administrators/SYSTEM only).
if ($PublicKey) {
    $keys = Join-Path $env:ProgramData 'ssh\administrators_authorized_keys'
    $existing = if (Test-Path -LiteralPath $keys) { @(Get-Content -LiteralPath $keys) } else { @() }
    if ($existing -notcontains $PublicKey.Trim()) {
        Add-Content -LiteralPath $keys -Value $PublicKey.Trim() -Encoding ASCII
    }
    & icacls.exe $keys /inheritance:r /grant '*S-1-5-32-544:F' /grant '*S-1-5-18:F' | Out-Null
    Write-Output 'SSH key authorized for administrators.'
}

$addresses = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object -ExpandProperty IPAddress
Write-Output ''
Write-Output 'SSH remote access is on.'
Write-Output "  Computer:  $env:COMPUTERNAME"
Write-Output "  Addresses: $($addresses -join ', ')"
Write-Output "  User:      $env:USERNAME (administrator)"
Write-Output "Next, on your Mac: pwsh scripts/windows/deploy-remote.ps1 -ComputerName $($addresses | Select-Object -First 1) -User $env:USERNAME"
