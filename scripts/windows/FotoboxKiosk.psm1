#Requires -Version 5.1
<#
.SYNOPSIS
  Configures a Windows PC as a Fotobox photo booth kiosk (and undoes it).

.DESCRIPTION
  Used by the Fotobox installer (NSIS hooks) through setup-kiosk.ps1. Runs as
  administrator under Windows PowerShell 5.1.

  Kiosk mode:
    - dedicated standard user that signs in automatically (password stored as
      LSA secret, like Sysinternals Autologon; never in the registry)
    - scheduled task that starts Fotobox at that user's logon and relaunches
      it within a minute if it exits or crashes
    - no sleep / screen-off / lock on wake, fewer notifications and escape
      routes (Task Manager, Win key, edge swipes), no reboots while signed in
  Both modes: firewall rule for the API (QR share links on the LAN) and the
  machine-wide host.json read by the app.

  Every change is recorded in %ProgramData%\Fotobox\applied.json together with
  the previous value, so switching to normal mode or uninstalling restores
  exactly what this module changed. All steps are idempotent.

  External effects go through small wrapper functions (Get/Set/Remove
  registry values, powercfg, LSA, local users, scheduled tasks, firewall) so
  the logic can be tested with Pester mocks on any OS.
#>

Set-StrictMode -Version 3.0

$script:TaskPath = '\Fotobox\'
$script:TaskName = 'Kiosk'
$script:FirewallRuleName = 'Fotobox-API'
$script:LegacyFirewallRuleName = 'Fotobox API (TCP 3000)'
$script:MachineRoot = 'HKLM:\'
$script:WinlogonKey = 'SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon'
# Mode and kiosk user of the last setup run; read by the installer on updates.
$script:SetupKey = 'SOFTWARE\Fotobox'

function Get-ConfigDir {
    <# %ProgramData%\Fotobox: host.json, applied.json and the setup log. #>
    [CmdletBinding()]
    [OutputType([string])]
    param()
    $programData = if ($env:ProgramData) { $env:ProgramData } else { 'C:\ProgramData' }
    return (Join-Path $programData 'Fotobox')
}

# --------------------------------------------------------------------------
# Logging
# --------------------------------------------------------------------------

function Write-FotoboxLog {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Message, [ValidateSet('INFO', 'WARN', 'ERROR')][string]$Level = 'INFO')
    $line = '{0:yyyy-MM-dd HH:mm:ss} [{1}] {2}' -f (Get-Date), $Level, $Message
    Write-Information $line -InformationAction Continue
}

# --------------------------------------------------------------------------
# Wrappers around external effects (mocked in tests)
# --------------------------------------------------------------------------

function Get-RegistryValue {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param([Parameter(Mandatory)][string]$Root, [Parameter(Mandatory)][string]$SubKey, [Parameter(Mandatory)][string]$Name)
    $key = Get-Item -LiteralPath (Join-Path $Root $SubKey) -ErrorAction SilentlyContinue
    if ($null -eq $key -or $key.GetValueNames() -notcontains $Name) {
        return @{ Exists = $false }
    }
    return @{
        Exists = $true
        Value  = $key.GetValue($Name, $null, 'DoNotExpandEnvironmentNames')
        Kind   = $key.GetValueKind($Name).ToString()
    }
}

function Set-RegistryValue {
    [CmdletBinding(SupportsShouldProcess)]
    param(
        [Parameter(Mandatory)][string]$Root, [Parameter(Mandatory)][string]$SubKey,
        [Parameter(Mandatory)][string]$Name, [Parameter(Mandatory)][AllowEmptyString()][object]$Value,
        [ValidateSet('String', 'DWord', 'QWord', 'ExpandString', 'MultiString', 'Binary')][string]$Kind = 'DWord'
    )
    $path = Join-Path $Root $SubKey
    if ($PSCmdlet.ShouldProcess("$path\$Name", "Set to $Value")) {
        if (-not (Test-Path -LiteralPath $path)) {
            New-Item -Path $path -Force | Out-Null
        }
        New-ItemProperty -LiteralPath $path -Name $Name -Value $Value -PropertyType $Kind -Force | Out-Null
    }
}

function Remove-RegistryValue {
    [CmdletBinding(SupportsShouldProcess)]
    param([Parameter(Mandatory)][string]$Root, [Parameter(Mandatory)][string]$SubKey, [Parameter(Mandatory)][string]$Name)
    $path = Join-Path $Root $SubKey
    if ((Test-Path -LiteralPath $path) -and $PSCmdlet.ShouldProcess("$path\$Name", 'Remove')) {
        Remove-ItemProperty -LiteralPath $path -Name $Name -ErrorAction SilentlyContinue
    }
}

function Invoke-Powercfg {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string[]]$Arguments)
    $output = & powercfg.exe @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "powercfg $($Arguments -join ' ') failed: $output"
    }
    return $output
}

function Set-LsaSecret {
    <#
      Stores an LSA private data secret, or deletes it with -Remove. (A
      [string] parameter turns $null into '', which would store an empty
      secret instead of deleting it.)
    #>
    [CmdletBinding(SupportsShouldProcess, DefaultParameterSetName = 'Store')]
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory, ParameterSetName = 'Store')][string]$Value,
        [Parameter(Mandatory, ParameterSetName = 'Remove')][switch]$Remove
    )
    if (-not $PSCmdlet.ShouldProcess("LSA secret $Name", 'Store')) {
        return
    }
    if (-not ('Fotobox.Lsa' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace Fotobox {
  public static class Lsa {
    [StructLayout(LayoutKind.Sequential)]
    struct LSA_UNICODE_STRING { public ushort Length; public ushort MaximumLength; public IntPtr Buffer; }
    [StructLayout(LayoutKind.Sequential)]
    struct LSA_OBJECT_ATTRIBUTES {
      public int Length; public IntPtr RootDirectory; public IntPtr ObjectName;
      public uint Attributes; public IntPtr SecurityDescriptor; public IntPtr SecurityQualityOfService;
    }
    [DllImport("advapi32.dll")] static extern uint LsaOpenPolicy(IntPtr system, ref LSA_OBJECT_ATTRIBUTES attributes, uint access, out IntPtr handle);
    [DllImport("advapi32.dll")] static extern uint LsaStorePrivateData(IntPtr handle, ref LSA_UNICODE_STRING key, IntPtr data);
    [DllImport("advapi32.dll")] static extern uint LsaNtStatusToWinError(uint status);
    [DllImport("advapi32.dll")] static extern uint LsaClose(IntPtr handle);
    const uint POLICY_CREATE_SECRET = 0x20;

    static LSA_UNICODE_STRING Make(string value) {
      var s = new LSA_UNICODE_STRING();
      s.Buffer = Marshal.StringToHGlobalUni(value);
      s.Length = (ushort)(value.Length * 2);
      s.MaximumLength = (ushort)((value.Length + 1) * 2);
      return s;
    }

    public static void Store(string name, string value) {
      var attributes = new LSA_OBJECT_ATTRIBUTES();
      attributes.Length = Marshal.SizeOf(attributes);
      IntPtr policy;
      uint status = LsaOpenPolicy(IntPtr.Zero, ref attributes, POLICY_CREATE_SECRET, out policy);
      if (status != 0) throw new System.ComponentModel.Win32Exception((int)LsaNtStatusToWinError(status));
      var key = Make(name);
      IntPtr data = IntPtr.Zero;
      try {
        if (value != null) {
          var secret = Make(value);
          data = Marshal.AllocHGlobal(Marshal.SizeOf(secret));
          Marshal.StructureToPtr(secret, data, false);
        }
        status = LsaStorePrivateData(policy, ref key, data);
        // Deleting a secret that does not exist is fine.
        if (status != 0 && !(value == null && LsaNtStatusToWinError(status) == 2))
          throw new System.ComponentModel.Win32Exception((int)LsaNtStatusToWinError(status));
      } finally {
        if (data != IntPtr.Zero) {
          var secret = (LSA_UNICODE_STRING)Marshal.PtrToStructure(data, typeof(LSA_UNICODE_STRING));
          Marshal.ZeroFreeGlobalAllocUnicode(secret.Buffer);
          Marshal.FreeHGlobal(data);
        }
        Marshal.FreeHGlobal(key.Buffer);
        LsaClose(policy);
      }
    }
  }
}
'@
    }
    if ($Remove) {
        [Fotobox.Lsa]::Store($Name, [NullString]::Value)
    }
    else {
        [Fotobox.Lsa]::Store($Name, $Value)
    }
}

function Get-WindowsEditionId {
    [CmdletBinding()]
    [OutputType([string])]
    param()
    $edition = Get-RegistryValue -Root $script:MachineRoot -SubKey 'SOFTWARE\Microsoft\Windows NT\CurrentVersion' -Name 'EditionID'
    if ($edition.Exists) { return [string]$edition.Value }
    return 'Unknown'
}

function Get-KioskLocalUser {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$UserName)
    return Get-LocalUser -Name $UserName -ErrorAction SilentlyContinue
}

function New-KioskLocalUser {
    [CmdletBinding(SupportsShouldProcess)]
    param([Parameter(Mandatory)][string]$UserName, [Parameter(Mandatory)][securestring]$Password)
    if ($PSCmdlet.ShouldProcess($UserName, 'Create local user')) {
        New-LocalUser -Name $UserName -Password $Password -FullName 'Fotobox' `
            -Description 'Fotobox kiosk (created by the Fotobox setup)' `
            -PasswordNeverExpires -UserMayNotChangePassword -AccountNeverExpires | Out-Null
        # Built-in "Users" group by SID: the group name is localized.
        Add-LocalGroupMember -SID 'S-1-5-32-545' -Member $UserName -ErrorAction SilentlyContinue
    }
}

function Set-KioskLocalUserPassword {
    [CmdletBinding(SupportsShouldProcess)]
    param([Parameter(Mandatory)][string]$UserName, [Parameter(Mandatory)][securestring]$Password)
    if ($PSCmdlet.ShouldProcess($UserName, 'Reset password and enable')) {
        Set-LocalUser -Name $UserName -Password $Password -PasswordNeverExpires $true
        Enable-LocalUser -Name $UserName
    }
}

function Remove-KioskLocalUser {
    [CmdletBinding(SupportsShouldProcess)]
    param([Parameter(Mandatory)][string]$UserName)
    if ($PSCmdlet.ShouldProcess($UserName, 'Remove local user')) {
        Remove-LocalUser -Name $UserName -ErrorAction SilentlyContinue
    }
}

function Register-KioskTask {
    [CmdletBinding(SupportsShouldProcess)]
    param([Parameter(Mandatory)][string]$ExePath, [Parameter(Mandatory)][string]$UserName)
    if (-not $PSCmdlet.ShouldProcess("$script:TaskPath$script:TaskName", 'Register scheduled task')) {
        return
    }
    $account = "$([Environment]::MachineName)\$UserName"
    # --autostart lets the app honour a maintenance pause ("Zu Windows wechseln").
    $action = New-ScheduledTaskAction -Execute $ExePath -Argument '--autostart' -WorkingDirectory (Split-Path -Parent $ExePath)
    $logon = New-ScheduledTaskTrigger -AtLogOn -User $account
    # Re-check every minute: starts Fotobox again if it exited or crashed.
    # MultipleInstances IgnoreNew + the app's single-instance guard prevent
    # duplicates while it is running.
    $logon.Repetition = (New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 1)).Repetition
    $principal = New-ScheduledTaskPrincipal -UserId $account -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan) `
        -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -Priority 4
    Register-ScheduledTask -TaskPath $script:TaskPath -TaskName $script:TaskName -Action $action `
        -Trigger $logon -Principal $principal -Settings $settings -Force | Out-Null
}

function Unregister-KioskTask {
    [CmdletBinding(SupportsShouldProcess)]
    param()
    $task = Get-ScheduledTask -TaskPath $script:TaskPath -TaskName $script:TaskName -ErrorAction SilentlyContinue
    if ($task -and $PSCmdlet.ShouldProcess("$script:TaskPath$script:TaskName", 'Unregister')) {
        Unregister-ScheduledTask -TaskPath $script:TaskPath -TaskName $script:TaskName -Confirm:$false
    }
}

function Set-ApiFirewallRule {
    [CmdletBinding(SupportsShouldProcess)]
    param([Parameter(Mandatory)][string]$NodePath, [Parameter(Mandatory)][int]$Port)
    if (-not $PSCmdlet.ShouldProcess($script:FirewallRuleName, 'Create firewall rule')) {
        return
    }
    Remove-ApiFirewallRule
    # Program-scoped so Windows doesn't prompt for node.exe; all profiles
    # because event Wi-Fi is often classified as Public.
    New-NetFirewallRule -Name $script:FirewallRuleName -DisplayName 'Fotobox API (QR share links)' `
        -Direction Inbound -Action Allow -Program $NodePath -Protocol TCP -LocalPort $Port -Profile Any | Out-Null
}

function Remove-ApiFirewallRule {
    [CmdletBinding(SupportsShouldProcess)]
    param()
    foreach ($rule in @(
            (Get-NetFirewallRule -Name $script:FirewallRuleName -ErrorAction SilentlyContinue),
            (Get-NetFirewallRule -DisplayName $script:LegacyFirewallRuleName -ErrorAction SilentlyContinue)
        )) {
        if ($rule -and $PSCmdlet.ShouldProcess($rule.DisplayName, 'Remove firewall rule')) {
            $rule | Remove-NetFirewallRule
        }
    }
}

function Get-UserHiveRoot {
    <#
      Registry root of the kiosk user's hive. Creates the profile if the user
      never signed in, and loads NTUSER.DAT under HKU\FotoboxKiosk when the
      user isn't signed in. Call Dismount-UserHive afterwards.
    #>
    [CmdletBinding()]
    [OutputType([hashtable])]
    param([Parameter(Mandatory)][string]$UserName)
    $sid = (Get-KioskLocalUser -UserName $UserName).SID.Value
    if (Test-Path -LiteralPath "Registry::HKEY_USERS\$sid") {
        return @{ Root = "Registry::HKEY_USERS\$sid\"; Mounted = $false }
    }
    $profileKey = "SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList\$sid"
    $profilePath = Get-RegistryValue -Root $script:MachineRoot -SubKey $profileKey -Name 'ProfileImagePath'
    if (-not $profilePath.Exists) {
        if (-not ('Fotobox.UserEnv' -as [type])) {
            Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
using System.Text;
namespace Fotobox {
  public static class UserEnv {
    [DllImport("userenv.dll", CharSet = CharSet.Unicode)]
    public static extern int CreateProfile(string sid, string userName, StringBuilder profilePath, uint size);
  }
}
'@
        }
        $buffer = New-Object System.Text.StringBuilder 260
        $hr = [Fotobox.UserEnv]::CreateProfile($sid, $UserName, $buffer, 260)
        # 0x800700B7 = profile already exists
        if ($hr -ne 0 -and $hr -ne -2147024713) {
            throw ('CreateProfile failed: 0x{0:X8}' -f $hr)
        }
        $profilePath = Get-RegistryValue -Root $script:MachineRoot -SubKey $profileKey -Name 'ProfileImagePath'
    }
    $hive = Join-Path ([Environment]::ExpandEnvironmentVariables([string]$profilePath.Value)) 'NTUSER.DAT'
    & reg.exe load 'HKU\FotoboxKiosk' $hive | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Cannot load registry hive $hive"
    }
    return @{ Root = 'Registry::HKEY_USERS\FotoboxKiosk\'; Mounted = $true }
}

function Dismount-UserHive {
    [CmdletBinding()]
    param([Parameter(Mandatory)][hashtable]$Hive)
    if ($Hive.Mounted) {
        [GC]::Collect()
        [GC]::WaitForPendingFinalizers()
        & reg.exe unload 'HKU\FotoboxKiosk' | Out-Null
    }
}

# --------------------------------------------------------------------------
# State (what this module changed, for undo)
# --------------------------------------------------------------------------

function Get-AppliedState {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param()
    $path = Join-Path (Get-ConfigDir) 'applied.json'
    $state = @{ Registry = @(); Power = @(); KioskUser = $null; UserPolicies = @() }
    if (Test-Path -LiteralPath $path) {
        $json = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
        foreach ($name in 'Registry', 'Power', 'UserPolicies') {
            if ($json.PSObject.Properties.Name -contains $name -and $null -ne $json.$name) {
                $state[$name] = @($json.$name)
            }
        }
        if ($json.PSObject.Properties.Name -contains 'KioskUser') {
            $state.KioskUser = $json.KioskUser
        }
    }
    return $state
}

function Save-AppliedState {
    [CmdletBinding()]
    param([Parameter(Mandatory)][hashtable]$State)
    Write-TextFile -Path (Join-Path (Get-ConfigDir) 'applied.json') -Content ($State | ConvertTo-Json -Depth 5)
}

function Write-TextFile {
    <# UTF-8 without BOM (Windows PowerShell 5's Set-Content adds one). #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][string]$Content)
    $dir = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding($false)))
}

function Set-RecordedRegistryValue {
    <# Sets a value, remembering the original the first time it is changed. #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)][hashtable]$State, [Parameter(Mandatory)][string]$Root,
        [ValidateSet('Machine', 'User')][string]$Scope = 'Machine',
        [Parameter(Mandatory)][string]$SubKey, [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][AllowEmptyString()][object]$Value, [string]$Kind = 'DWord'
    )
    $list = if ($Scope -eq 'User') { 'UserPolicies' } else { 'Registry' }
    $known = @($State[$list] | Where-Object { $_.SubKey -eq $SubKey -and $_.Name -eq $Name })
    if ($known.Count -eq 0) {
        $previous = Get-RegistryValue -Root $Root -SubKey $SubKey -Name $Name
        $entry = [ordered]@{ SubKey = $SubKey; Name = $Name; PreviousExists = [bool]$previous.Exists }
        if ($previous.Exists) {
            $entry.PreviousValue = $previous.Value
            $entry.PreviousKind = $previous.Kind
        }
        $State[$list] = @($State[$list]) + [pscustomobject]$entry
    }
    Set-RegistryValue -Root $Root -SubKey $SubKey -Name $Name -Value $Value -Kind $Kind
}

function Restore-RecordedRegistryValue {
    [CmdletBinding()]
    param([Parameter(Mandatory)][hashtable]$State, [Parameter(Mandatory)][string]$Root, [ValidateSet('Machine', 'User')][string]$Scope = 'Machine')
    $list = if ($Scope -eq 'User') { 'UserPolicies' } else { 'Registry' }
    foreach ($entry in @($State[$list])) {
        if ($entry.PreviousExists) {
            Set-RegistryValue -Root $Root -SubKey $entry.SubKey -Name $entry.Name -Value $entry.PreviousValue -Kind $entry.PreviousKind
        }
        else {
            Remove-RegistryValue -Root $Root -SubKey $entry.SubKey -Name $entry.Name
        }
    }
    $State[$list] = @()
}

# --------------------------------------------------------------------------
# Building blocks
# --------------------------------------------------------------------------

function New-KioskPassword {
    <# 24 random characters from all four character classes. #>
    [CmdletBinding()]
    [OutputType([string])]
    param([int]$Length = 24)
    $sets = @('ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!#%+-=?@_')
    $all = -join $sets
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object byte[] ($Length)
    $rng.GetBytes($bytes)
    $chars = for ($i = 0; $i -lt $Length; $i++) {
        $pool = if ($i -lt $sets.Count) { $sets[$i] } else { $all }
        $pool[$bytes[$i] % $pool.Length]
    }
    # Shuffle so the guaranteed classes aren't always at the start.
    $order = New-Object byte[] ($Length)
    $rng.GetBytes($order)
    $shuffled = for ($i = 0; $i -lt $Length; $i++) { [pscustomobject]@{ C = $chars[$i]; K = $order[$i] } }
    return -join ($shuffled | Sort-Object K | ForEach-Object { $_.C })
}

function New-LanToken {
    [CmdletBinding()]
    [OutputType([string])]
    param()
    $bytes = New-Object byte[] 24
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    return ([Convert]::ToBase64String($bytes)).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Set-HostConfig {
    <# Machine-wide settings read by the app (apps/fotobox-tauri config.rs). #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][hashtable]$Config)
    $path = Join-Path (Get-ConfigDir) 'host.json'
    Write-TextFile -Path $path -Content (([pscustomobject]$Config) | ConvertTo-Json)
    Protect-ConfigDirectory
}

function Get-HostConfigValue {
    [CmdletBinding()]
    param([Parameter(Mandatory)][string]$Name)
    $path = Join-Path (Get-ConfigDir) 'host.json'
    if (-not (Test-Path -LiteralPath $path)) { return $null }
    $json = Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    if ($json.PSObject.Properties.Name -contains $Name) { return $json.$Name }
    return $null
}

function Protect-ConfigDirectory {
    <# Admins/SYSTEM full control, users read-only (host.json holds the LAN token). #>
    [CmdletBinding()]
    param()
    & icacls.exe (Get-ConfigDir) /inheritance:r /grant:r '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-545:(OI)(CI)RX' | Out-Null
}

function Set-KioskUser {
    <# Creates the standard user (or resets its password) and returns the new password. #>
    [CmdletBinding()]
    [OutputType([securestring])]
    param([Parameter(Mandatory)][string]$UserName)
    $secure = New-Object System.Security.SecureString
    foreach ($char in (New-KioskPassword).ToCharArray()) {
        $secure.AppendChar($char)
    }
    $secure.MakeReadOnly()
    if (Get-KioskLocalUser -UserName $UserName) {
        Write-FotoboxLog "Kiosk user '$UserName' exists; resetting its password for auto-logon"
        Set-KioskLocalUserPassword -UserName $UserName -Password $secure
    }
    else {
        Write-FotoboxLog "Creating standard user '$UserName'"
        New-KioskLocalUser -UserName $UserName -Password $secure
    }
    return $secure
}

function Enable-AutoLogon {
    [CmdletBinding()]
    param([Parameter(Mandatory)][hashtable]$State, [Parameter(Mandatory)][string]$UserName, [Parameter(Mandatory)][securestring]$Password)
    $winlogon = $script:WinlogonKey
    Set-RecordedRegistryValue -State $State -Root $script:MachineRoot -SubKey $winlogon -Name 'AutoAdminLogon' -Value '1' -Kind String
    Set-RecordedRegistryValue -State $State -Root $script:MachineRoot -SubKey $winlogon -Name 'DefaultUserName' -Value $UserName -Kind String
    Set-RecordedRegistryValue -State $State -Root $script:MachineRoot -SubKey $winlogon -Name 'DefaultDomainName' -Value ([Environment]::MachineName) -Kind String
    # Never keep a plaintext password in the registry.
    Remove-RegistryValue -Root $script:MachineRoot -SubKey $winlogon -Name 'DefaultPassword'
    Remove-RegistryValue -Root $script:MachineRoot -SubKey $winlogon -Name 'AutoLogonCount'
    # The LSA API needs the plain text; keep it only for this call.
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Password)
    try {
        Set-LsaSecret -Name 'DefaultPassword' -Value ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr))
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
    # Windows Hello-only sign-in blocks password auto-logon.
    Set-RecordedRegistryValue -State $State -Root $script:MachineRoot `
        -SubKey 'SOFTWARE\Microsoft\Windows NT\CurrentVersion\PasswordLess\Device' -Name 'DevicePasswordLessBuildVersion' -Value 0
}

function Disable-AutoLogon {
    [CmdletBinding()]
    param()
    Set-LsaSecret -Name 'DefaultPassword' -Remove
}

function Set-PowerSetting {
    <# Never sleep, turn off the screen or ask for a password on wake (AC and battery). #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][hashtable]$State)
    $settings = @(
        @{ Sub = 'SUB_SLEEP'; Setting = 'STANDBYIDLE' },
        @{ Sub = 'SUB_SLEEP'; Setting = 'HIBERNATEIDLE' },
        @{ Sub = 'SUB_VIDEO'; Setting = 'VIDEOIDLE' },
        @{ Sub = 'SUB_NONE'; Setting = 'CONSOLELOCK' }
    )
    foreach ($s in $settings) {
        $known = @($State.Power | Where-Object { $_.Sub -eq $s.Sub -and $_.Setting -eq $s.Setting })
        if ($known.Count -eq 0) {
            $current = Get-PowerSettingIndex -Sub $s.Sub -Setting $s.Setting
            $State.Power = @($State.Power) + [pscustomobject]@{ Sub = $s.Sub; Setting = $s.Setting; Ac = $current.Ac; Dc = $current.Dc }
        }
        Invoke-Powercfg -Arguments @('/setacvalueindex', 'SCHEME_CURRENT', $s.Sub, $s.Setting, '0') | Out-Null
        Invoke-Powercfg -Arguments @('/setdcvalueindex', 'SCHEME_CURRENT', $s.Sub, $s.Setting, '0') | Out-Null
    }
    Invoke-Powercfg -Arguments @('/setactive', 'SCHEME_CURRENT') | Out-Null
}

function Get-PowerSettingIndex {
    [CmdletBinding()]
    [OutputType([hashtable])]
    param([Parameter(Mandatory)][string]$Sub, [Parameter(Mandatory)][string]$Setting)
    $text = (Invoke-Powercfg -Arguments @('/query', 'SCHEME_CURRENT', $Sub, $Setting)) -join "`n"
    # The labels are localized, but the two indexes are the last two hex values.
    $values = [regex]::Matches($text, ':\s*(0x[0-9a-fA-F]+)\s*$', 'Multiline') | ForEach-Object { [Convert]::ToInt64($_.Groups[1].Value, 16) }
    $values = @($values)
    if ($values.Count -lt 2) {
        return @{ Ac = $null; Dc = $null }
    }
    return @{ Ac = $values[$values.Count - 2]; Dc = $values[$values.Count - 1] }
}

function Restore-PowerSetting {
    [CmdletBinding()]
    param([Parameter(Mandatory)][hashtable]$State)
    foreach ($s in @($State.Power)) {
        if ($null -ne $s.Ac) { Invoke-Powercfg -Arguments @('/setacvalueindex', 'SCHEME_CURRENT', $s.Sub, $s.Setting, [string]$s.Ac) | Out-Null }
        if ($null -ne $s.Dc) { Invoke-Powercfg -Arguments @('/setdcvalueindex', 'SCHEME_CURRENT', $s.Sub, $s.Setting, [string]$s.Dc) | Out-Null }
    }
    if (@($State.Power).Count -gt 0) {
        Invoke-Powercfg -Arguments @('/setactive', 'SCHEME_CURRENT') | Out-Null
    }
    $State.Power = @()
}

function Set-SystemPolicy {
    <# Machine-wide lockdown. Some policies only take effect on Pro/Enterprise/Education. #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][hashtable]$State)
    $edition = Get-WindowsEditionId
    if ($edition -match '^Core') {
        Write-FotoboxLog "Windows edition '$edition': edge-swipe, lock-screen and update policies are best effort on Home" -Level WARN
    }
    $values = @(
        @{ SubKey = 'SOFTWARE\Policies\Microsoft\Windows\EdgeUI'; Name = 'AllowEdgeSwipe'; Value = 0 },
        @{ SubKey = 'SOFTWARE\Policies\Microsoft\Windows\Personalization'; Name = 'NoLockScreen'; Value = 1 },
        @{ SubKey = 'SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU'; Name = 'NoAutoRebootWithLoggedOnUsers'; Value = 1 },
        @{ SubKey = 'SOFTWARE\Microsoft\WindowsUpdate\UX\Settings'; Name = 'ActiveHoursStart'; Value = 6 },
        @{ SubKey = 'SOFTWARE\Microsoft\WindowsUpdate\UX\Settings'; Name = 'ActiveHoursEnd'; Value = 0 }
    )
    foreach ($v in $values) {
        Set-RecordedRegistryValue -State $State -Root $script:MachineRoot -SubKey $v.SubKey -Name $v.Name -Value $v.Value
    }
}

function Get-UserPolicyDefinition {
    [CmdletBinding()]
    [OutputType([hashtable[]])]
    param()
    return @(
        @{ SubKey = 'Software\Microsoft\Windows\CurrentVersion\Policies\System'; Name = 'DisableTaskMgr'; Value = 1 },
        @{ SubKey = 'Software\Microsoft\Windows\CurrentVersion\Policies\System'; Name = 'DisableLockWorkstation'; Value = 1 },
        @{ SubKey = 'Software\Microsoft\Windows\CurrentVersion\Policies\System'; Name = 'DisableChangePassword'; Value = 1 },
        @{ SubKey = 'Software\Microsoft\Windows\CurrentVersion\Policies\Explorer'; Name = 'NoWinKeys'; Value = 1 },
        @{ SubKey = 'Software\Microsoft\Windows\CurrentVersion\Policies\Explorer'; Name = 'NoRun'; Value = 1 },
        @{ SubKey = 'Software\Policies\Microsoft\Windows\CurrentVersion\PushNotifications'; Name = 'NoToastApplicationNotification'; Value = 1 },
        @{ SubKey = 'Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager'; Name = 'SubscribedContent-310093Enabled'; Value = 0 },
        @{ SubKey = 'Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager'; Name = 'SoftLandingEnabled'; Value = 0 },
        @{ SubKey = 'Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager'; Name = 'SystemPaneSuggestionsEnabled'; Value = 0 },
        @{ SubKey = 'Software\Microsoft\Windows\CurrentVersion\UserProfileEngagement'; Name = 'ScoobeSystemSettingEnabled'; Value = 0 },
        @{ SubKey = 'Control Panel\Desktop'; Name = 'ScreenSaveActive'; Value = '0'; Kind = 'String' }
    )
}

function Set-UserPolicy {
    [CmdletBinding()]
    param([Parameter(Mandatory)][hashtable]$State, [Parameter(Mandatory)][string]$UserName)
    $hive = Get-UserHiveRoot -UserName $UserName
    try {
        foreach ($v in Get-UserPolicyDefinition) {
            $kind = if ($v.ContainsKey('Kind')) { $v.Kind } else { 'DWord' }
            Set-RecordedRegistryValue -State $State -Scope User -Root $hive.Root -SubKey $v.SubKey -Name $v.Name -Value $v.Value -Kind $kind
        }
    }
    finally {
        Dismount-UserHive -Hive $hive
    }
}

function Restore-UserPolicy {
    [CmdletBinding()]
    param([Parameter(Mandatory)][hashtable]$State, [Parameter(Mandatory)][string]$UserName)
    if (@($State.UserPolicies).Count -eq 0 -or -not (Get-KioskLocalUser -UserName $UserName)) {
        $State.UserPolicies = @()
        return
    }
    $hive = Get-UserHiveRoot -UserName $UserName
    try {
        Restore-RecordedRegistryValue -State $State -Scope User -Root $hive.Root
    }
    finally {
        Dismount-UserHive -Hive $hive
    }
}

function Remove-LegacyAutostart {
    <# Login items from earlier app versions (per-user Run key, Startup shortcut). #>
    [CmdletBinding()]
    param()
    Remove-RegistryValue -Root 'HKCU:\' -SubKey 'Software\Microsoft\Windows\CurrentVersion\Run' -Name 'Fotobox'
    $startup = Join-Path ([Environment]::GetFolderPath('Startup')) 'Fotobox.lnk'
    if (Test-Path -LiteralPath $startup) {
        Remove-Item -LiteralPath $startup -Force
    }
}

# --------------------------------------------------------------------------
# Entry points
# --------------------------------------------------------------------------

function Install-FotoboxKiosk {
    <#
    .SYNOPSIS
      Applies normal or kiosk mode. Returns a summary object.
    .PARAMETER LanToken
      'none' (default), 'auto' (generate), 'keep' (token of the current
      host.json, for updates) or an explicit token for tablet mode.
    #>
    [CmdletBinding()]
    param(
        [ValidateSet('Kiosk', 'Normal')][string]$Mode = 'Kiosk',
        [Parameter(Mandatory)][string]$InstallDir,
        [string]$KioskUser = 'Fotobox',
        [string]$LanToken = 'none',
        [ValidateRange(1, 65535)][int]$Port = 3000
    )
    # Plain string paths: these are Windows paths even when tests run elsewhere.
    $dir = $InstallDir.TrimEnd('\')
    $exe = "$dir\Fotobox.exe"
    $node = "$dir\node.exe"
    $state = Get-AppliedState
    Write-FotoboxLog "Configuring Fotobox ($Mode mode) for $exe on Windows edition $(Get-WindowsEditionId)"

    $token = switch ($LanToken) {
        'none' { $null }
        'auto' { New-LanToken }
        'keep' { Get-HostConfigValue -Name 'lanApiToken' }
        default { $LanToken }
    }

    Remove-LegacyAutostart
    Set-ApiFirewallRule -NodePath $node -Port $Port

    if ($Mode -eq 'Kiosk') {
        $password = Set-KioskUser -UserName $KioskUser
        $state.KioskUser = $KioskUser
        Enable-AutoLogon -State $state -UserName $KioskUser -Password $password
        Register-KioskTask -ExePath $exe -UserName $KioskUser
        Set-PowerSetting -State $state
        Set-SystemPolicy -State $state
        Set-UserPolicy -State $state -UserName $KioskUser
    }
    else {
        Remove-KioskConfiguration -State $state
    }

    $config = [ordered]@{
        managedBy   = 'installer'
        mode        = $Mode.ToLowerInvariant()
        kiosk       = ($Mode -eq 'Kiosk')
        kioskUser   = $(if ($Mode -eq 'Kiosk') { $KioskUser } else { $null })
        port        = $Port
        allowLanApi = ($null -ne $token)
    }
    if ($token) { $config.lanApiToken = $token }
    Set-HostConfig -Config $config
    Save-AppliedState -State $state
    Set-RegistryValue -Root $script:MachineRoot -SubKey $script:SetupKey -Name 'SetupMode' -Value $Mode -Kind String
    Set-RegistryValue -Root $script:MachineRoot -SubKey $script:SetupKey -Name 'KioskUser' -Value $KioskUser -Kind String

    Write-FotoboxLog "Done ($Mode mode). Restart Windows to start the booth."
    return [pscustomobject]@{ Mode = $Mode; KioskUser = $(if ($Mode -eq 'Kiosk') { $KioskUser } else { $null }); LanToken = $token }
}

function Remove-KioskConfiguration {
    <# Undoes kiosk-only changes (auto-logon, task, power, policies). #>
    [CmdletBinding()]
    param([Parameter(Mandatory)][hashtable]$State)
    Unregister-KioskTask
    Disable-AutoLogon
    if ($State.KioskUser) {
        Restore-UserPolicy -State $State -UserName $State.KioskUser
    }
    Restore-RecordedRegistryValue -State $State -Root $script:MachineRoot
    Restore-PowerSetting -State $State
}

function Uninstall-FotoboxKiosk {
    <#
    .SYNOPSIS
      Removes everything this module configured. Keeps the kiosk user and its
      photos unless -RemoveKioskUser is given.
    #>
    [CmdletBinding()]
    param([switch]$RemoveKioskUser)
    $state = Get-AppliedState
    Write-FotoboxLog 'Removing Fotobox kiosk configuration'
    Remove-KioskConfiguration -State $state
    Remove-ApiFirewallRule
    Remove-LegacyAutostart
    if ($RemoveKioskUser -and $state.KioskUser) {
        Write-FotoboxLog "Removing user '$($state.KioskUser)'"
        Remove-KioskLocalUser -UserName $state.KioskUser
    }
    Remove-RegistryValue -Root $script:MachineRoot -SubKey $script:SetupKey -Name 'SetupMode'
    Remove-RegistryValue -Root $script:MachineRoot -SubKey $script:SetupKey -Name 'KioskUser'
    foreach ($file in 'host.json', 'applied.json') {
        $path = Join-Path (Get-ConfigDir) $file
        if (Test-Path -LiteralPath $path) {
            Remove-Item -LiteralPath $path -Force
        }
    }
    Write-FotoboxLog 'Fotobox kiosk configuration removed'
}

Export-ModuleMember -Function Install-FotoboxKiosk, Uninstall-FotoboxKiosk, Get-AppliedState, New-KioskPassword, New-LanToken, Get-PowerSettingIndex
