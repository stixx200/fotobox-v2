#Requires -Version 5.1
<#
.SYNOPSIS
  Sets up a Fotobox PC over the network (SSH) from your Mac or PC.

.DESCRIPTION
  Copies provision-fotobox.ps1, FotoboxProvision.psm1, your configuration
  and the Fotobox setup to the target PC and runs the provisioning there as
  administrator. Uses the ssh/scp tools of your system (macOS, Linux and
  Windows 10+ ship them), so it runs with PowerShell 7 on macOS:
    brew install --cask powershell

  On the target PC, run enable-remote-access.ps1 once first.

.PARAMETER ComputerName
  Host name or IP address of the target PC.
.PARAMETER User
  Administrator account on the target PC.
.PARAMETER ConfigPath
  Your configuration (copy of fotobox-provision.example.psd1).
.PARAMETER SetupPath
  Fotobox setup (Fotobox_<version>_x64-setup.exe), e.g. from a release or
  `pnpm nx run fotobox-tauri:bundle` on Windows.
.PARAMETER IncludePath
  Further files or folders to copy next to the script (e.g. a printer
  driver folder referenced by PrinterDriverInf).
.PARAMETER IdentityFile
  SSH private key (default: ssh's own defaults, or password login).
.PARAMETER Restart
  Restart the target PC when done (starts the booth).
.EXAMPLE
  pwsh scripts/windows/deploy-remote.ps1 -ComputerName 192.168.1.50 -User admin `
    -ConfigPath ./fotobox-provision.psd1 -SetupPath ./Fotobox_1.0.0_x64-setup.exe -Restart
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$ComputerName,
    [Parameter(Mandatory)][string]$User,
    [Parameter(Mandatory)][string]$ConfigPath,
    [Parameter(Mandatory)][string]$SetupPath,
    [string[]]$IncludePath = @(),
    [string]$IdentityFile,
    [string]$RemoteDir = 'C:\FotoboxSetup',
    [switch]$Restart
)

$ErrorActionPreference = 'Stop'

foreach ($tool in 'ssh', 'scp') {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "'$tool' not found. Install the OpenSSH client."
    }
}
foreach ($path in @($ConfigPath, $SetupPath) + $IncludePath) {
    if (-not (Test-Path -LiteralPath $path)) { throw "Not found: $path" }
}
# Fails early on syntax errors instead of on the target.
Import-PowerShellDataFile -LiteralPath $ConfigPath | Out-Null

$target = "$User@$ComputerName"
$sshOptions = @('-o', 'ServerAliveInterval=30')
if ($IdentityFile) { $sshOptions += @('-i', $IdentityFile) }

function Invoke-Remote {
    <# Runs PowerShell code on the target; returns its exit code. #>
    param([Parameter(Mandatory)][string]$Script)
    # -EncodedCommand avoids quoting through the remote shell.
    $encoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($Script))
    & ssh @sshOptions $target "powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand $encoded" | Out-Host
    return $LASTEXITCODE
}

Write-Output "Preparing $RemoteDir on $ComputerName..."
$code = Invoke-Remote "Remove-Item -LiteralPath '$RemoteDir' -Recurse -Force -ErrorAction SilentlyContinue; New-Item -ItemType Directory -Path '$RemoteDir' -Force | Out-Null"
if ($code -ne 0) { throw "Cannot reach $target over SSH (exit code $code). Did you run enable-remote-access.ps1 on it?" }

# Staging folder with the final file names.
$staging = Join-Path ([System.IO.Path]::GetTempPath()) "fotobox-deploy-$([guid]::NewGuid())"
New-Item -ItemType Directory -Path $staging | Out-Null
try {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'provision-fotobox.ps1') -Destination $staging
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'FotoboxProvision.psm1') -Destination $staging
    Copy-Item -LiteralPath $ConfigPath -Destination (Join-Path $staging 'fotobox-provision.psd1')
    Copy-Item -LiteralPath $SetupPath -Destination $staging
    foreach ($path in $IncludePath) {
        Copy-Item -LiteralPath $path -Destination $staging -Recurse
    }

    Write-Output "Copying setup files to ${ComputerName}:$RemoteDir..."
    $remotePath = $RemoteDir.Replace('\', '/')
    $items = @(Get-ChildItem -LiteralPath $staging | ForEach-Object { $_.FullName })
    & scp @sshOptions -r @items "${target}:$remotePath/"
    if ($LASTEXITCODE -ne 0) { throw "Copying to $target failed (exit code $LASTEXITCODE)" }
}
finally {
    Remove-Item -LiteralPath $staging -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Output 'Running the provisioning (takes a few minutes)...'
$restartArgument = if ($Restart) { ' -Restart' } else { '' }
$code = Invoke-Remote "& '$RemoteDir\provision-fotobox.ps1'$restartArgument; exit `$LASTEXITCODE"
if ($code -ne 0) {
    throw "Provisioning failed (exit code $code). Log on the target: C:\ProgramData\Fotobox\provision.log"
}
Write-Output "Done. $(if ($Restart) { 'The PC restarts and starts the booth.' } else { 'Restart the PC to start the booth.' })"
