#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.6' }
# Unit tests for FotoboxKiosk.psm1. All system changes go through wrapper
# functions that are mocked here, so the tests run on any OS without admin.
# Run: Invoke-Pester scripts/windows/tests

BeforeAll {
    Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'FotoboxKiosk.psm1') -Force
}

Describe 'FotoboxKiosk' {
    BeforeEach {
        $env:ProgramData = Join-Path $TestDrive ([guid]::NewGuid().ToString())
        $script:configDir = Join-Path $env:ProgramData 'Fotobox'

        InModuleScope FotoboxKiosk {
            # In-memory registry: "<root>|<subkey>|<name>" -> @{ Value; Kind }
            $script:Reg = @{
                'HKLM:\|SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon|DefaultUserName' = @{ Value = 'Admin'; Kind = 'String' }
                'HKLM:\|SOFTWARE\Microsoft\Windows NT\CurrentVersion|EditionID'                = @{ Value = 'Professional'; Kind = 'String' }
            }
            $script:Lsa = @{}
            $script:Calls = [System.Collections.Generic.List[string]]::new()
            $script:Users = @{}
            $script:Power = @{}

            Mock Get-RegistryValue {
                $entry = $script:Reg["$Root|$SubKey|$Name"]
                if ($null -eq $entry) { return @{ Exists = $false } }
                return @{ Exists = $true; Value = $entry.Value; Kind = $entry.Kind }
            }
            Mock Set-RegistryValue { $script:Reg["$Root|$SubKey|$Name"] = @{ Value = $Value; Kind = $Kind } }
            Mock Remove-RegistryValue { $script:Reg.Remove("$Root|$SubKey|$Name") }
            Mock Set-LsaSecret { if ($Remove) { $script:Lsa.Remove($Name) } else { $script:Lsa[$Name] = $Value } }
            Mock Invoke-Powercfg {
                $script:Calls.Add("powercfg $($Arguments -join ' ')")
                if ($Arguments[0] -eq '/query') {
                    return @(
                        "Energieschema-GUID: 381b4222-f694-41f0-9685-ff5bb260df2e  (Ausbalanciert)",
                        "    Index der aktuellen Wechselstromeinstellung: 0x00000384",
                        "    Index der aktuellen Gleichstromeinstellung: 0x0000012c"
                    )
                }
                if ($Arguments.Count -eq 5) {
                    $script:Power["$($Arguments[0])|$($Arguments[2])|$($Arguments[3])"] = $Arguments[4]
                }
            }
            Mock Get-KioskLocalUser { if ($script:Users.ContainsKey($UserName)) { [pscustomobject]@{ Name = $UserName } } }
            Mock New-KioskLocalUser { $script:Users[$UserName] = $Password; $script:Calls.Add("new-user $UserName") }
            Mock Set-KioskLocalUserPassword { $script:Users[$UserName] = $Password; $script:Calls.Add("reset-password $UserName") }
            Mock Remove-KioskLocalUser { $script:Users.Remove($UserName); $script:Calls.Add("remove-user $UserName") }
            Mock Register-KioskTask { $script:Calls.Add("register-task $ExePath $UserName") }
            Mock Unregister-KioskTask { $script:Calls.Add('unregister-task') }
            Mock Set-ApiFirewallRule { $script:Calls.Add("firewall $NodePath $Port") }
            Mock Remove-ApiFirewallRule { $script:Calls.Add('remove-firewall') }
            Mock Get-UserHiveRoot { @{ Root = 'HKU:\Kiosk\'; Mounted = $true } }
            Mock Dismount-UserHive { $script:Calls.Add('dismount-hive') }
            Mock Protect-ConfigDirectory {}
            Mock Remove-LegacyAutostart { $script:Calls.Add('remove-legacy-autostart') }
            Mock Write-FotoboxLog {}
        }

        function Get-HostJson { Get-Content (Join-Path $script:configDir 'host.json') -Raw | ConvertFrom-Json }
        function Get-Reg([string]$Key) { InModuleScope FotoboxKiosk -Parameters @{ Key = $Key } { $script:Reg[$Key] } }
        function Get-CallLog { InModuleScope FotoboxKiosk { , $script:Calls.ToArray() } }
    }

    Context 'kiosk mode' {
        It 'creates the kiosk user with auto-logon and a relaunching task' {
            $result = Install-FotoboxKiosk -Mode Kiosk -InstallDir 'C:\Program Files\Fotobox'

            $result.Mode | Should -Be 'Kiosk'
            $result.KioskUser | Should -Be 'Fotobox'
            $calls = Get-CallLog
            $calls | Should -Contain 'new-user Fotobox'
            $calls | Should -Contain 'register-task C:\Program Files\Fotobox\Fotobox.exe Fotobox'
            $calls | Should -Contain 'firewall C:\Program Files\Fotobox\node.exe 5100'
            $calls | Should -Contain 'dismount-hive'

            (Get-Reg 'HKLM:\|SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon|AutoAdminLogon').Value | Should -Be '1'
            (Get-Reg 'HKLM:\|SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon|DefaultUserName').Value | Should -Be 'Fotobox'
            Get-Reg 'HKLM:\|SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon|DefaultPassword' | Should -BeNullOrEmpty
            InModuleScope FotoboxKiosk { $script:Lsa['DefaultPassword'].Length } | Should -Be 24
        }

        It 'stores the same password for the user and auto-logon' {
            Install-FotoboxKiosk -Mode Kiosk -InstallDir 'C:\Fotobox'
            InModuleScope FotoboxKiosk {
                $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR(
                    [Runtime.InteropServices.Marshal]::SecureStringToBSTR($script:Users['Fotobox']))
                $plain | Should -Be $script:Lsa['DefaultPassword']
            }
        }

        It 'locks down the kiosk user and keeps the PC awake' {
            Install-FotoboxKiosk -Mode Kiosk -InstallDir 'C:\Fotobox'

            (Get-Reg 'HKU:\Kiosk\|Software\Microsoft\Windows\CurrentVersion\Policies\System|DisableTaskMgr').Value | Should -Be 1
            (Get-Reg 'HKU:\Kiosk\|Software\Microsoft\Windows\CurrentVersion\Policies\Explorer|NoWinKeys').Value | Should -Be 1
            (Get-Reg 'HKLM:\|SOFTWARE\Policies\Microsoft\Windows\EdgeUI|AllowEdgeSwipe').Value | Should -Be 0
            InModuleScope FotoboxKiosk {
                $script:Power['/setacvalueindex|SUB_SLEEP|STANDBYIDLE'] | Should -Be '0'
                $script:Power['/setdcvalueindex|SUB_VIDEO|VIDEOIDLE'] | Should -Be '0'
                $script:Power['/setdcvalueindex|SUB_NONE|CONSOLELOCK'] | Should -Be '0'
            }
        }

        It 'writes host.json for the app' {
            Install-FotoboxKiosk -Mode Kiosk -InstallDir 'C:\Fotobox' -Port 3100

            $hostJson = Get-HostJson
            $hostJson.managedBy | Should -Be 'installer'
            $hostJson.kiosk | Should -BeTrue
            $hostJson.kioskUser | Should -Be 'Fotobox'
            $hostJson.port | Should -Be 3100
            $hostJson.allowLanApi | Should -BeFalse
            $hostJson.PSObject.Properties.Name | Should -Not -Contain 'lanApiToken'
            # UTF-8 without BOM
            [IO.File]::ReadAllBytes((Join-Path $script:configDir 'host.json'))[0] | Should -Be ([byte][char]'{')
        }

        It 'generates a URL-safe LAN token for tablet mode' {
            $result = Install-FotoboxKiosk -Mode Kiosk -InstallDir 'C:\Fotobox' -LanToken auto

            $result.LanToken | Should -Match '^[A-Za-z0-9_-]{32}$'
            (Get-HostJson).allowLanApi | Should -BeTrue
            (Get-HostJson).lanApiToken | Should -Be $result.LanToken
        }

        It 'keeps the existing LAN token on updates' {
            $first = Install-FotoboxKiosk -Mode Kiosk -InstallDir 'C:\Fotobox' -LanToken auto
            $update = Install-FotoboxKiosk -Mode Kiosk -InstallDir 'C:\Fotobox' -LanToken keep
            $update.LanToken | Should -Be $first.LanToken
            (Get-HostJson).lanApiToken | Should -Be $first.LanToken
        }

        It 'remembers mode and kiosk user for the installer' {
            Install-FotoboxKiosk -Mode Kiosk -InstallDir 'C:\Fotobox' -KioskUser 'Booth'
            (Get-Reg 'HKLM:\|SOFTWARE\Fotobox|SetupMode').Value | Should -Be 'Kiosk'
            (Get-Reg 'HKLM:\|SOFTWARE\Fotobox|KioskUser').Value | Should -Be 'Booth'
        }

        It 'is idempotent and remembers the original values only once' {
            Install-FotoboxKiosk -Mode Kiosk -InstallDir 'C:\Fotobox'
            Install-FotoboxKiosk -Mode Kiosk -InstallDir 'C:\Fotobox'

            (Get-CallLog) | Should -Contain 'reset-password Fotobox'
            $state = Get-AppliedState
            $userName = @($state.Registry | Where-Object Name -EQ 'DefaultUserName')
            $userName.Count | Should -Be 1
            $userName[0].PreviousValue | Should -Be 'Admin'
            @($state.Power | Where-Object Setting -EQ 'STANDBYIDLE').Count | Should -Be 1
            @($state.UserPolicies | Where-Object Name -EQ 'DisableTaskMgr').Count | Should -Be 1
        }
    }

    Context 'switching back to normal mode' {
        It 'restores every value the kiosk setup changed' {
            Install-FotoboxKiosk -Mode Kiosk -InstallDir 'C:\Fotobox'
            Install-FotoboxKiosk -Mode Normal -InstallDir 'C:\Fotobox'

            (Get-Reg 'HKLM:\|SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon|DefaultUserName').Value | Should -Be 'Admin'
            Get-Reg 'HKLM:\|SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon|AutoAdminLogon' | Should -BeNullOrEmpty
            Get-Reg 'HKLM:\|SOFTWARE\Policies\Microsoft\Windows\EdgeUI|AllowEdgeSwipe' | Should -BeNullOrEmpty
            Get-Reg 'HKU:\Kiosk\|Software\Microsoft\Windows\CurrentVersion\Policies\System|DisableTaskMgr' | Should -BeNullOrEmpty
            InModuleScope FotoboxKiosk {
                $script:Lsa.ContainsKey('DefaultPassword') | Should -BeFalse
                $script:Power['/setacvalueindex|SUB_SLEEP|STANDBYIDLE'] | Should -Be '900'
                $script:Power['/setdcvalueindex|SUB_SLEEP|STANDBYIDLE'] | Should -Be '300'
            }
            (Get-CallLog) | Should -Contain 'unregister-task'

            $hostJson = Get-HostJson
            $hostJson.kiosk | Should -BeFalse
            $hostJson.mode | Should -Be 'normal'
            $state = Get-AppliedState
            @($state.Registry).Count | Should -Be 0
            @($state.Power).Count | Should -Be 0
        }

        It 'keeps the firewall rule for QR share links' {
            Install-FotoboxKiosk -Mode Normal -InstallDir 'C:\Fotobox'
            (Get-CallLog) | Should -Contain 'firewall C:\Fotobox\node.exe 5100'
            (Get-CallLog) | Should -Not -Contain 'new-user Fotobox'
        }
    }

    Context 'uninstall' {
        It 'removes the configuration but keeps the kiosk user and its photos' {
            Install-FotoboxKiosk -Mode Kiosk -InstallDir 'C:\Fotobox'
            Uninstall-FotoboxKiosk

            (Get-CallLog) | Should -Contain 'remove-firewall'
            (Get-CallLog) | Should -Not -Contain 'remove-user Fotobox'
            Join-Path $script:configDir 'host.json' | Should -Not -Exist
            Join-Path $script:configDir 'applied.json' | Should -Not -Exist
            Get-Reg 'HKLM:\|SOFTWARE\Fotobox|SetupMode' | Should -BeNullOrEmpty
            Get-Reg 'HKLM:\|SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon|AutoAdminLogon' | Should -BeNullOrEmpty
        }

        It 'removes the kiosk user on request' {
            Install-FotoboxKiosk -Mode Kiosk -InstallDir 'C:\Fotobox'
            Uninstall-FotoboxKiosk -RemoveKioskUser
            (Get-CallLog) | Should -Contain 'remove-user Fotobox'
        }

        It 'works when nothing was configured' {
            { Uninstall-FotoboxKiosk } | Should -Not -Throw
        }
    }

    Context 'helpers' {
        It 'generates strong, different kiosk passwords' {
            $a = New-KioskPassword
            $b = New-KioskPassword
            $a.Length | Should -Be 24
            $a | Should -Not -Be $b
            $a | Should -MatchExactly '[A-Z]'
            $a | Should -MatchExactly '[a-z]'
            $a | Should -Match '[0-9]'
            $a | Should -Match '[!#%+\-=?@_]'
        }

        It 'parses localized powercfg output' {
            $index = Get-PowerSettingIndex -Sub SUB_SLEEP -Setting STANDBYIDLE
            $index.Ac | Should -Be 900
            $index.Dc | Should -Be 300
        }
    }
}
