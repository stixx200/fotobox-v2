#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.6' }
<#
  End-to-end test of the Fotobox NSIS installer on a disposable Windows
  machine (GitHub Actions windows runner, run as administrator). It really
  installs, configures kiosk mode and uninstalls - never run it on a PC you
  care about.

  FOTOBOX_SETUP_EXE: path to Fotobox_<version>_x64-setup.exe
#>

BeforeDiscovery {
    $script:skip = -not $env:FOTOBOX_SETUP_EXE
}

BeforeAll {
    $script:setupExe = $env:FOTOBOX_SETUP_EXE
    $script:installDir = Join-Path $env:ProgramFiles 'Fotobox'
    $script:configDir = Join-Path $env:ProgramData 'Fotobox'
    $script:winlogon = 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon'
    $script:originalWinlogon = Get-ItemProperty $script:winlogon

    function Invoke-Setup([string[]]$Arguments) {
        $process = Start-Process -FilePath $script:setupExe -ArgumentList $Arguments -Wait -PassThru
        $process.ExitCode | Should -Be 0
    }

    function Get-HostJson {
        Get-Content (Join-Path $script:configDir 'host.json') -Raw | ConvertFrom-Json
    }

    function Get-StandbyAcIndex {
        $text = (powercfg /query SCHEME_CURRENT SUB_SLEEP STANDBYIDLE) -join "`n"
        $values = [regex]::Matches($text, ':\s*(0x[0-9a-fA-F]+)\s*$', 'Multiline') | ForEach-Object { [Convert]::ToInt64($_.Groups[1].Value, 16) }
        return @($values)[-2]
    }

    $script:originalStandby = Get-StandbyAcIndex

    function Write-SidecarDiagnostic {
        # App and API logs of this (runner) account, then the API started
        # directly to capture its start-up error.
        $logDir = Join-Path $env:LOCALAPPDATA 'de.se-voelk.fotobox\logs'
        $logs = Get-ChildItem -LiteralPath $logDir -Filter '*.log' -ErrorAction SilentlyContinue |
            ForEach-Object { "=== $($_.FullName)"; Get-Content -LiteralPath $_.FullName -Tail 60 }
        Write-Information -MessageData ($logs | Out-String) -InformationAction Continue

        $out = Join-Path $env:TEMP 'fotobox-api-direct'
        $node = Start-Process -FilePath (Join-Path $installDir 'node.exe') -ArgumentList '"api\main.js"' `
            -WorkingDirectory $installDir -RedirectStandardOutput "$out.out" -RedirectStandardError "$out.err" -PassThru
        Start-Sleep -Seconds 20
        Stop-Process -Id $node.Id -Force -ErrorAction SilentlyContinue
        $direct = foreach ($file in "$out.out", "$out.err") { "=== $file"; Get-Content -LiteralPath $file -Tail 60 -ErrorAction SilentlyContinue }
        Write-Information -MessageData ($direct | Out-String) -InformationAction Continue
    }
}

Describe 'Fotobox installer (kiosk mode)' -Skip:$skip {
    It 'installs silently in kiosk mode' {
        Invoke-Setup @('/S', '/KIOSK=1', '/LANTOKEN=auto')
        Write-Information -MessageData (Get-Content (Join-Path $configDir 'setup.log') -Raw) -InformationAction Continue
    }

    It 'installs the app, the Node sidecar and the setup scripts' {
        foreach ($file in 'Fotobox.exe', 'node.exe', 'setup-kiosk.ps1', 'FotoboxKiosk.psm1', 'api\main.js', 'uninstall.exe') {
            Join-Path $installDir $file | Should -Exist
        }
    }

    It 'creates a standard (non-admin) kiosk user' {
        $user = Get-LocalUser -Name 'Fotobox'
        $user.Enabled | Should -BeTrue
        (Get-LocalGroupMember -SID 'S-1-5-32-545').Name | Should -Contain "$env:COMPUTERNAME\Fotobox"
        (Get-LocalGroupMember -SID 'S-1-5-32-544').Name | Should -Not -Contain "$env:COMPUTERNAME\Fotobox"
    }

    It 'enables auto-logon without a plaintext password' {
        $values = Get-ItemProperty $winlogon
        $values.AutoAdminLogon | Should -Be '1'
        $values.DefaultUserName | Should -Be 'Fotobox'
        $values.PSObject.Properties.Name | Should -Not -Contain 'DefaultPassword'
    }

    It 'registers the relaunching autostart task for the kiosk user' {
        $task = Get-ScheduledTask -TaskPath '\Fotobox\' -TaskName 'Kiosk'
        $task.Actions[0].Execute | Should -Be (Join-Path $installDir 'Fotobox.exe')
        $task.Actions[0].Arguments | Should -Be '--autostart'
        $task.Principal.UserId | Should -Match 'Fotobox$'
        $task.Settings.MultipleInstances | Should -Be 'IgnoreNew'
        $task.Triggers[0].Repetition.Interval | Should -Be 'PT1M'
    }

    It 'opens the firewall for the bundled node.exe only' {
        $rule = Get-NetFirewallRule -Name 'Fotobox-API'
        ($rule | Get-NetFirewallApplicationFilter).Program | Should -Be (Join-Path $installDir 'node.exe')
        ($rule | Get-NetFirewallPortFilter).LocalPort | Should -Be '5100'
    }

    It 'writes host.json for the kiosk user with a LAN token' {
        $hostJson = Get-HostJson
        $hostJson.managedBy | Should -Be 'installer'
        $hostJson.kiosk | Should -BeTrue
        $hostJson.kioskUser | Should -Be 'Fotobox'
        $hostJson.allowLanApi | Should -BeTrue
        $hostJson.lanApiToken | Should -Match '^[A-Za-z0-9_-]{32}$'
        (Get-ItemProperty 'HKLM:\SOFTWARE\Fotobox').SetupMode | Should -Be 'Kiosk'
    }

    It 'keeps the PC awake' {
        Get-StandbyAcIndex | Should -Be 0
    }

    It 'starts the app and its API sidecar from Program Files' {
        # The runner account is not the kiosk user, so the app opens a normal window.
        $app = Start-Process -FilePath (Join-Path $installDir 'Fotobox.exe') -PassThru
        try {
            $healthy = $false
            for ($i = 0; $i -lt 60 -and -not $healthy; $i++) {
                Start-Sleep -Seconds 2
                try {
                    $response = Invoke-RestMethod -Uri 'http://127.0.0.1:5100/graphql' -Method Post `
                        -ContentType 'application/json' -Body '{"query":"{ __typename }"}' -TimeoutSec 5
                    $healthy = $response.data.__typename -eq 'Query'
                }
                catch { $null = $_ }
            }
            if (-not $healthy) { Write-SidecarDiagnostic }
            $healthy | Should -BeTrue -Because 'the bundled Node sidecar (sharp, node:sqlite) must run from the install dir'
        }
        finally {
            Stop-Process -Id $app.Id -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 3
        }
        Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object Path -EQ (Join-Path $installDir 'node.exe') |
            Should -BeNullOrEmpty -Because 'the API exits together with the app'
    }

    It 'keeps mode and tablet token when a newer setup runs (update)' {
        $token = (Get-HostJson).lanApiToken
        Invoke-Setup @('/S')
        $hostJson = Get-HostJson
        $hostJson.kiosk | Should -BeTrue
        $hostJson.lanApiToken | Should -Be $token
        $applied = Get-Content (Join-Path $configDir 'applied.json') -Raw | ConvertFrom-Json
        $userName = @($applied.Registry | Where-Object Name -EQ 'DefaultUserName')
        $userName.Count | Should -Be 1
        $userName[0].PreviousExists | Should -Be ($originalWinlogon.PSObject.Properties.Name -contains 'DefaultUserName')
    }

    It 'uninstalls and removes the kiosk configuration' {
        $uninstaller = Join-Path $installDir 'uninstall.exe'
        $process = Start-Process -FilePath $uninstaller -ArgumentList @('/S', "_?=$installDir") -Wait -PassThru
        $process.ExitCode | Should -Be 0
        Write-Information -MessageData (Get-Content (Join-Path $configDir 'setup.log') -Raw) -InformationAction Continue

        Get-ScheduledTask -TaskPath '\Fotobox\' -TaskName 'Kiosk' -ErrorAction SilentlyContinue | Should -BeNullOrEmpty
        Get-NetFirewallRule -Name 'Fotobox-API' -ErrorAction SilentlyContinue | Should -BeNullOrEmpty
        $values = Get-ItemProperty $winlogon
        foreach ($name in 'AutoAdminLogon', 'DefaultUserName', 'DefaultDomainName') {
            $values.$name | Should -Be $originalWinlogon.$name -Because "$name is restored"
        }
        Join-Path $configDir 'host.json' | Should -Not -Exist
        Test-Path 'HKLM:\SOFTWARE\Fotobox' | Should -BeFalse
        Get-StandbyAcIndex | Should -Be $originalStandby
        # A silent uninstall keeps the kiosk user and its photos.
        Get-LocalUser -Name 'Fotobox' | Should -Not -BeNullOrEmpty
    }
}
