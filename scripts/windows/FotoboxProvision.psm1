#Requires -Version 5.1
<#
.SYNOPSIS
  Sets up a freshly installed Windows PC as a Fotobox, end to end.

.DESCRIPTION
  Used by provision-fotobox.ps1 (run locally or over SSH from another
  computer). Runs as administrator under Windows PowerShell 5.1.

    - computer name and time zone
    - SSH server for remote maintenance (installed if missing)
    - power: "Höchstleistung" plan (or the best performance mode on devices
      without it), never sleep, hibernate, dim or turn off the screen, no USB
      selective suspend, closing the lid does nothing
    - optional Wi-Fi profile and printer driver
    - Fotobox installed silently in kiosk mode (kiosk user, auto-logon,
      autostart, lockdown: see FotoboxKiosk.psm1)
    - photo and collage folders, writable by the kiosk user; collage
      templates shipped next to the script are copied there
    - Fotobox settings written to %ProgramData%\Fotobox\provisioning.json;
      the app applies them on its next start (and again whenever the file
      changes; changes made in the app are kept otherwise)

  External effects go through small wrapper functions so the logic can be
  tested with Pester mocks on any OS.
#>

Set-StrictMode -Version 3.0

# Built-in "Höchstleistung" (High performance) plan and the "Beste Leistung"
# (best performance) power mode of devices that only offer "Ausbalanciert".
$script:HighPerformanceScheme = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'
$script:BestPerformanceOverlay = 'ded574b5-45a0-4f42-8737-46345c09c238'

# powercfg <subgroup> <setting> pairs set to 0 for AC and battery:
# never sleep, hibernate, dim or turn off the screen or disks, no USB
# selective suspend, closing the lid does nothing.
$script:AlwaysOnSettings = @(
    @{ Sub = 'SUB_SLEEP'; Setting = 'STANDBYIDLE' },
    @{ Sub = 'SUB_SLEEP'; Setting = 'HIBERNATEIDLE' },
    @{ Sub = 'SUB_SLEEP'; Setting = 'HYBRIDSLEEP' },
    @{ Sub = 'SUB_VIDEO'; Setting = 'VIDEOIDLE' },
    @{ Sub = 'SUB_VIDEO'; Setting = 'VIDEODIM' },
    @{ Sub = 'SUB_VIDEO'; Setting = 'VIDEOADAPT' },
    @{ Sub = 'SUB_DISK'; Setting = 'DISKIDLE' },
    @{ Sub = '2a737441-1930-4402-8d77-b2bebba308a3'; Setting = '48e6b7a6-50f5-4782-a5d4-53bb8f07e226' },
    @{ Sub = 'SUB_BUTTONS'; Setting = 'LIDACTION' }
)

# --------------------------------------------------------------------------
# Logging
# --------------------------------------------------------------------------

function Write-ProvisionLog {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Message, [ValidateSet('INFO', 'WARN', 'ERROR')][string]$Level = 'INFO')
    $line = '{0:yyyy-MM-dd HH:mm:ss} [{1}] {2}' -f (Get-Date), $Level, $Message
    Write-Information $line -InformationAction Continue
}

# --------------------------------------------------------------------------
# Wrappers around external effects (mocked in tests)
# --------------------------------------------------------------------------

function Invoke-PowercfgCommand {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string[]]$Arguments)
    $output = & powercfg.exe @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "powercfg $($Arguments -join ' ') failed: $output"
    }
    return $output
}

function Invoke-SetupProgram {
    <# Runs the Fotobox setup and returns its exit code. #>
    [CmdletBinding()]
    [OutputType([int])]
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string[]]$Arguments)
    $process = Start-Process -FilePath $Path -ArgumentList $Arguments -Wait -PassThru
    return $process.ExitCode
}

function Invoke-NativeCommand {
    <# Runs a command-line tool (netsh, pnputil, icacls); throws on failure. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$FilePath, [Parameter(Mandatory)][string[]]$Arguments)
    $output = & $FilePath @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "$FilePath $($Arguments -join ' ') failed ($LASTEXITCODE): $output"
    }
    return $output
}

function Get-ComputerIdentity {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param()
    return @{ Name = $env:COMPUTERNAME; TimeZone = (Get-TimeZone).Id }
}

function Set-ComputerNameValue {
    [CmdletBinding(SupportsShouldProcess)]
    param([Parameter(Mandatory)][string]$Name)
    if ($PSCmdlet.ShouldProcess($env:COMPUTERNAME, "Rename to $Name")) {
        Rename-Computer -NewName $Name -Force -WarningAction SilentlyContinue
    }
}

function Set-TimeZoneValue {
    [CmdletBinding(SupportsShouldProcess)]
    param([Parameter(Mandatory)][string]$Id)
    if ($PSCmdlet.ShouldProcess('time zone', "Set to $Id")) {
        Set-TimeZone -Id $Id
    }
}

function Disable-NetworkPowerSaving {
    <# Keeps network adapters awake (QR share links, remote maintenance). #>
    [CmdletBinding()]
    param()
    Get-NetAdapter -Physical -ErrorAction SilentlyContinue | ForEach-Object {
        try {
            Disable-NetAdapterPowerManagement -Name $_.Name -NoRestart -ErrorAction Stop
        }
        catch {
            Write-ProvisionLog "Power management of adapter '$($_.Name)' not changed: $($_.Exception.Message)" -Level WARN
        }
    }
}

function Get-SshServerState {
    <# 'Installed' when the OpenSSH server feature is present. #>
    [CmdletBinding()]
    [OutputType([hashtable])]
    param()
    $capability = Get-WindowsCapability -Online -Name 'OpenSSH.Server*' | Select-Object -First 1
    return @{ Name = $capability.Name; State = [string]$capability.State }
}

function Install-SshServerFeature {
    [CmdletBinding(SupportsShouldProcess)]
    param([Parameter(Mandatory)][string]$Name)
    if ($PSCmdlet.ShouldProcess($Name, 'Install Windows feature')) {
        Add-WindowsCapability -Online -Name $Name | Out-Null
    }
}

function Set-SshServerConfiguration {
    <# Service on at boot, port 22 for the local network, PowerShell as shell. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$FirewallRule)
    Set-Service sshd -StartupType Automatic
    Start-Service sshd
    # Any network profile: a fresh install often marks the network as public.
    Remove-NetFirewallRule -Name $FirewallRule -ErrorAction SilentlyContinue
    New-NetFirewallRule -Name $FirewallRule -DisplayName 'Fotobox remote maintenance (SSH)' -Direction Inbound `
        -Protocol TCP -LocalPort 22 -RemoteAddress LocalSubnet -Profile Any -Action Allow | Out-Null
    $shell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    New-Item -Path 'HKLM:\SOFTWARE\OpenSSH' -Force | Out-Null
    New-ItemProperty -Path 'HKLM:\SOFTWARE\OpenSSH' -Name DefaultShell -Value $shell -PropertyType String -Force | Out-Null
}

function Add-SshAdministratorKey {
    <# Key login for administrators (file owned by Administrators/SYSTEM only). #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$PublicKey)
    $keys = Join-Path $env:ProgramData 'ssh\administrators_authorized_keys'
    $existing = if (Test-Path -LiteralPath $keys) { @(Get-Content -LiteralPath $keys) } else { @() }
    if ($existing -notcontains $PublicKey.Trim()) {
        Add-Content -LiteralPath $keys -Value $PublicKey.Trim() -Encoding ASCII
    }
    Invoke-NativeCommand -FilePath 'icacls.exe' -Arguments @($keys, '/inheritance:r', '/grant', '*S-1-5-32-544:F', '/grant', '*S-1-5-18:F') | Out-Null
}

function Copy-CollageTemplate {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Source, [Parameter(Mandatory)][string]$Destination)
    Copy-Item -Path (Join-Path $Source '*') -Destination $Destination -Recurse -Force
}

function Test-FotoboxInstalled {
    [CmdletBinding()]
    [OutputType([bool])]
    param([Parameter(Mandatory)][string]$InstallDir)
    return (Test-Path -LiteralPath (Join-Path $InstallDir 'Fotobox.exe'))
}

function New-FotoboxDirectory {
    [CmdletBinding(SupportsShouldProcess)]
    param([Parameter(Mandatory)][string]$Path)
    if ($PSCmdlet.ShouldProcess($Path, 'Create directory')) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Write-ProvisionFile {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$Content)
    New-Item -ItemType Directory -Path (Split-Path -Parent $Path) -Force | Out-Null
    # UTF-8 without BOM (the app tolerates a BOM, other tools may not).
    [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding($false)))
}

# --------------------------------------------------------------------------
# Steps
# --------------------------------------------------------------------------

function Set-ComputerIdentity {
    <# Returns $true when a restart is needed (new computer name). #>
    [CmdletBinding()]
    [OutputType([bool])]
    param([string]$ComputerName, [string]$TimeZone)
    $current = Get-ComputerIdentity
    if ($TimeZone -and $TimeZone -ne $current.TimeZone) {
        Write-ProvisionLog "Time zone: $TimeZone"
        Set-TimeZoneValue -Id $TimeZone
    }
    if ($ComputerName -and $ComputerName -ne $current.Name) {
        Write-ProvisionLog "Computer name: $ComputerName (after the restart)"
        Set-ComputerNameValue -Name $ComputerName
        return $true
    }
    return $false
}

function Enable-SshRemoteAccess {
    <#
    .SYNOPSIS
      Installs the OpenSSH server if missing and opens it for the local
      network, so the booth can be maintained from another computer
      (deploy-remote.ps1). Needs internet when the feature is missing.
    #>
    [CmdletBinding()]
    param([string]$PublicKey)
    $state = Get-SshServerState
    if ($state.State -ne 'Installed') {
        Write-ProvisionLog "Installing $($state.Name) (needs internet)"
        Install-SshServerFeature -Name $state.Name
    }
    Set-SshServerConfiguration -FirewallRule 'Fotobox-SSH'
    if ($PublicKey) {
        Add-SshAdministratorKey -PublicKey $PublicKey
        Write-ProvisionLog 'SSH key authorized for administrators'
    }
    Write-ProvisionLog 'SSH server on (port 22, local network only)'
}

function Get-PowerSchemeGuid {
    <# GUIDs listed by `powercfg /list` (labels are localized, GUIDs are not). #>
    [CmdletBinding()]
    [OutputType([string[]])]
    param()
    $text = (Invoke-PowercfgCommand -Arguments @('/list')) -join "`n"
    return @([regex]::Matches($text, '[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}') |
            ForEach-Object { $_.Value.ToLowerInvariant() })
}

function Enable-HighPerformancePower {
    <#
    .SYNOPSIS
      Activates "Höchstleistung" and keeps the PC, screen, disks and USB
      devices always on. Returns the active plan's GUID ('overlay' when only
      the best performance mode could be set).
    #>
    [CmdletBinding()]
    [OutputType([string])]
    param()
    $schemes = Get-PowerSchemeGuid
    $scheme = $null
    if ($schemes -contains $script:HighPerformanceScheme) {
        $scheme = $script:HighPerformanceScheme
    }
    else {
        # Hidden on many current PCs: restore it from the built-in template.
        try {
            $output = (Invoke-PowercfgCommand -Arguments @('/duplicatescheme', $script:HighPerformanceScheme)) -join ' '
            $match = [regex]::Match($output, '[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}')
            if ($match.Success) { $scheme = $match.Value.ToLowerInvariant() }
        }
        catch {
            Write-ProvisionLog "No 'Höchstleistung' plan on this device (Modern Standby?): $($_.Exception.Message)" -Level WARN
        }
    }

    if ($scheme) {
        Invoke-PowercfgCommand -Arguments @('/setactive', $scheme) | Out-Null
        Write-ProvisionLog "Power plan 'Höchstleistung' active ($scheme)"
    }
    else {
        # Devices with Modern Standby only offer "Ausbalanciert"; use its
        # best performance mode instead.
        Invoke-PowercfgCommand -Arguments @('/overlaysetactive', $script:BestPerformanceOverlay) | Out-Null
        Write-ProvisionLog "Power mode 'Beste Leistung' active (plan 'Ausbalanciert')"
        $scheme = 'overlay'
    }

    foreach ($s in $script:AlwaysOnSettings) {
        foreach ($kind in '/setacvalueindex', '/setdcvalueindex') {
            try {
                Invoke-PowercfgCommand -Arguments @($kind, 'SCHEME_CURRENT', $s.Sub, $s.Setting, '0') | Out-Null
            }
            catch {
                # Not every device has every setting (no lid, no battery, ...).
                Write-ProvisionLog "Power setting $($s.Sub)/$($s.Setting) not available" -Level WARN
                break
            }
        }
    }
    Invoke-PowercfgCommand -Arguments @('/setactive', 'SCHEME_CURRENT') | Out-Null
    # No hibernation file and no fast startup: a clean boot every time.
    Invoke-PowercfgCommand -Arguments @('/hibernate', 'off') | Out-Null
    Disable-NetworkPowerSaving
    Write-ProvisionLog 'Never sleep, hibernate or turn off the screen (AC and battery)'
    return $scheme
}

function Add-WifiProfile {
    <# Saves a WPA2/WPA3-Personal network so the booth connects automatically. #>
    [Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSAvoidUsingPlainTextForPassword', 'Password',
        Justification = 'Wi-Fi key from the plain-text configuration file; netsh needs it as text.')]
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Ssid, [Parameter(Mandatory)][string]$Password)
    $escape = { param($value) [System.Security.SecurityElement]::Escape($value) }
    $xml = @"
<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
  <name>$(& $escape $Ssid)</name>
  <SSIDConfig><SSID><name>$(& $escape $Ssid)</name></SSID></SSIDConfig>
  <connectionType>ESS</connectionType>
  <connectionMode>auto</connectionMode>
  <MSM><security>
    <authEncryption><authentication>WPA2PSK</authentication><encryption>AES</encryption><useOneX>false</useOneX></authEncryption>
    <sharedKey><keyType>passPhrase</keyType><protected>false</protected><keyMaterial>$(& $escape $Password)</keyMaterial></sharedKey>
  </security></MSM>
</WLANProfile>
"@
    $file = Join-Path ([System.IO.Path]::GetTempPath()) "fotobox-wifi-$([guid]::NewGuid()).xml"
    try {
        Write-ProvisionFile -Path $file -Content $xml
        Invoke-NativeCommand -FilePath 'netsh.exe' -Arguments @('wlan', 'add', 'profile', "filename=$file", 'user=all') | Out-Null
        Write-ProvisionLog "Wi-Fi '$Ssid' saved (connects automatically)"
    }
    finally {
        Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue
    }
}

function Install-PrinterDriver {
    <# Adds and installs a printer driver package (.inf) from the setup folder. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$InfPath)
    Invoke-NativeCommand -FilePath 'pnputil.exe' -Arguments @('/add-driver', $InfPath, '/install') | Out-Null
    Write-ProvisionLog "Printer driver installed: $InfPath"
}

function Install-FotoboxApp {
    <#
    .SYNOPSIS
      Installs (or updates) Fotobox silently in kiosk mode. The setup runs
      setup-kiosk.ps1 itself (kiosk user, auto-logon, autostart, lockdown).
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][string]$SetupPath,
        [Parameter(Mandatory)][string]$InstallDir,
        [string]$KioskUser = 'Fotobox',
        [string]$LanToken = 'none'
    )
    $arguments = @('/S', '/KIOSK=1', "/KIOSKUSER=$KioskUser", "/LANTOKEN=$LanToken")
    Write-ProvisionLog "Installing $(Split-Path -Leaf $SetupPath) (kiosk user '$KioskUser')"
    $exitCode = Invoke-SetupProgram -Path $SetupPath -Arguments $arguments
    if ($exitCode -ne 0) {
        throw "Fotobox setup failed with exit code $exitCode (see %ProgramData%\Fotobox\setup.log)"
    }
    if (-not (Test-FotoboxInstalled -InstallDir $InstallDir)) {
        throw "Fotobox.exe not found in $InstallDir after the setup"
    }
    Write-ProvisionLog "Fotobox installed in $InstallDir"
}

function Set-FotoboxDirectory {
    <# Creates a folder the kiosk user may write to (photos, collage templates). #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$KioskUser)
    New-FotoboxDirectory -Path $Path
    Invoke-NativeCommand -FilePath 'icacls.exe' -Arguments @($Path, '/grant', "${KioskUser}:(OI)(CI)M") | Out-Null
    Write-ProvisionLog "Folder ready: $Path (writable by $KioskUser)"
}

function ConvertTo-ProvisionedSettingsJson {
    <#
    .SYNOPSIS
      JSON for provisioning.json: { "settings": { ... } }. Folder settings
      come from -Directories, the rest is passed through as plain values
      (strings, numbers, booleans, arrays).
    #>
    [CmdletBinding()]
    [OutputType([string])]
    param([hashtable]$Settings = @{}, [hashtable]$Directories = @{})
    $merged = [ordered]@{}
    foreach ($key in ($Settings.Keys | Sort-Object)) {
        $merged[$key] = $Settings[$key]
    }
    if ($Directories['Photos']) { $merged['photoDirectory'] = $Directories['Photos'] }
    if ($Directories['Collages']) { $merged['collageDirectory'] = $Directories['Collages'] }
    return ([pscustomobject]@{ settings = [pscustomobject]$merged } | ConvertTo-Json -Depth 5)
}

function Get-ProvisioningPath {
    [CmdletBinding()]
    [OutputType([string])]
    param()
    $programData = if ($env:ProgramData) { $env:ProgramData } else { 'C:\ProgramData' }
    return (Join-Path (Join-Path $programData 'Fotobox') 'provisioning.json')
}

# --------------------------------------------------------------------------
# Entry point
# --------------------------------------------------------------------------

function Invoke-FotoboxProvisioning {
    <#
    .SYNOPSIS
      Runs every step for the given configuration (see
      fotobox-provision.example.psd1). Returns a summary object.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][hashtable]$Config,
        [Parameter(Mandatory)][string]$SetupPath,
        [string]$BaseDir = (Split-Path -Parent $SetupPath)
    )
    $kioskUser = if ($Config['KioskUser']) { [string]$Config['KioskUser'] } else { 'Fotobox' }
    $installDir = if ($Config['InstallDir']) { [string]$Config['InstallDir'] } else { "$env:ProgramFiles\Fotobox" }
    $lanToken = if ($Config['LanToken']) { [string]$Config['LanToken'] } else { 'none' }
    $directories = if ($Config['Directories']) { $Config['Directories'] } else { @{} }
    $settings = if ($Config['Settings']) { $Config['Settings'] } else { @{} }

    $renamed = Set-ComputerIdentity -ComputerName $Config['ComputerName'] -TimeZone $Config['TimeZone']

    # Early, so the PC can be reached even if a later step fails.
    $remote = if ($Config['RemoteAccess']) { $Config['RemoteAccess'] } else { @{} }
    if ($remote['Enabled'] -ne $false) {
        Enable-SshRemoteAccess -PublicKey $remote['PublicKey']
    }

    # Before the Fotobox setup: its kiosk power settings go to the active plan.
    $powerScheme = Enable-HighPerformancePower

    if ($Config['Wifi'] -and $Config['Wifi']['Ssid']) {
        Add-WifiProfile -Ssid $Config['Wifi']['Ssid'] -Password $Config['Wifi']['Password']
    }
    if ($Config['PrinterDriverInf']) {
        $inf = [string]$Config['PrinterDriverInf']
        if (-not [System.IO.Path]::IsPathRooted($inf)) { $inf = [System.IO.Path]::Combine($BaseDir, $inf) }
        Install-PrinterDriver -InfPath $inf
    }

    Install-FotoboxApp -SetupPath $SetupPath -InstallDir $installDir -KioskUser $kioskUser -LanToken $lanToken

    foreach ($path in @($directories['Photos'], $directories['Collages'])) {
        if ($path) { Set-FotoboxDirectory -Path $path -KioskUser $kioskUser }
    }
    $templates = [System.IO.Path]::Combine($BaseDir, 'Collagen')
    if ($directories['Collages'] -and (Test-Path -LiteralPath $templates)) {
        Copy-CollageTemplate -Source $templates -Destination $directories['Collages']
        Write-ProvisionLog "Collage templates copied to $($directories['Collages'])"
    }

    $provisioningPath = Get-ProvisioningPath
    Write-ProvisionFile -Path $provisioningPath -Content (ConvertTo-ProvisionedSettingsJson -Settings $settings -Directories $directories)
    Write-ProvisionLog "Fotobox settings written to $provisioningPath (applied when the app starts)"

    return [pscustomobject]@{
        KioskUser        = $kioskUser
        InstallDir       = $installDir
        PowerScheme      = $powerScheme
        ProvisioningFile = $provisioningPath
        RestartRequired  = $true
        Renamed          = $renamed
    }
}

Export-ModuleMember -Function Invoke-FotoboxProvisioning, ConvertTo-ProvisionedSettingsJson, Enable-HighPerformancePower, Enable-SshRemoteAccess
