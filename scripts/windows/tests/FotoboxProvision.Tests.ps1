#Requires -Modules @{ ModuleName = 'Pester'; ModuleVersion = '5.6' }
# Unit tests for FotoboxProvision.psm1. External commands go through wrapper
# functions that are mocked here, so the tests run on any OS without admin.
# Run: Invoke-Pester scripts/windows/tests

BeforeAll {
    Import-Module (Join-Path (Split-Path -Parent $PSScriptRoot) 'FotoboxProvision.psm1') -Force
}

Describe 'FotoboxProvision' {
    BeforeEach {
        $env:ProgramData = Join-Path $TestDrive ([guid]::NewGuid().ToString())

        InModuleScope FotoboxProvision {
            $script:Calls = [System.Collections.Generic.List[string]]::new()
            $script:Schemes = @('381b4222-f694-41f0-9685-ff5bb260df2e', '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c')
            $script:MissingSettings = @()
            $script:SetupExitCode = 0

            Mock Invoke-PowercfgCommand {
                $script:Calls.Add("powercfg $($Arguments -join ' ')")
                switch ($Arguments[0]) {
                    '/list' {
                        return $script:Schemes | ForEach-Object { "Energieschema-GUID: $_  (Plan)" }
                    }
                    '/duplicatescheme' {
                        if ($script:Schemes -notcontains 'duplicate-ok') { throw 'Unzulässige Parameter' }
                        return 'Energieschema-GUID: 11111111-2222-3333-4444-555555555555  (Höchstleistung)'
                    }
                    { $_ -in '/setacvalueindex', '/setdcvalueindex' } {
                        if ($script:MissingSettings -contains $Arguments[3]) { throw 'not available' }
                    }
                }
            }
            Mock Invoke-SetupProgram { $script:Calls.Add("setup $Path $($Arguments -join ' ')"); $script:SetupExitCode }
            Mock Invoke-NativeCommand { $script:Calls.Add("$FilePath $($Arguments -join ' ')") }
            Mock Get-ComputerIdentity { @{ Name = 'DESKTOP-1'; TimeZone = 'UTC' } }
            Mock Set-ComputerNameValue { $script:Calls.Add("rename $Name") }
            Mock Set-TimeZoneValue { $script:Calls.Add("timezone $Id") }
            Mock Disable-NetworkPowerSaving { $script:Calls.Add('network-power') }
            Mock Test-FotoboxInstalled { $true }
            Mock New-FotoboxDirectory { $script:Calls.Add("mkdir $Path") }
            Mock Write-ProvisionLog {}
        }

        function Get-CallLog { InModuleScope FotoboxProvision { , $script:Calls.ToArray() } }
        $script:config = @{
            ComputerName = 'FOTOBOX'
            TimeZone     = 'W. Europe Standard Time'
            KioskUser    = 'Booth'
            Directories  = @{ Photos = 'C:\Fotobox\Fotos' }
            Settings     = @{ camera = 'sony'; layouts = @('Einzelbild'); usePrinter = $true; shutterTimeout = 3 }
        }
    }

    Context 'power' {
        It 'activates Höchstleistung and keeps everything on' {
            Enable-HighPerformancePower | Should -Be '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'
            $calls = Get-CallLog
            $calls | Should -Contain 'powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'
            $calls | Should -Contain 'powercfg /setacvalueindex SCHEME_CURRENT SUB_VIDEO VIDEOIDLE 0'
            $calls | Should -Contain 'powercfg /setdcvalueindex SCHEME_CURRENT SUB_SLEEP STANDBYIDLE 0'
            $calls | Should -Contain 'powercfg /setacvalueindex SCHEME_CURRENT SUB_BUTTONS LIDACTION 0'
            $calls | Should -Contain 'powercfg /hibernate off'
            $calls | Should -Contain 'network-power'
        }

        It 'restores a hidden Höchstleistung plan' {
            InModuleScope FotoboxProvision { $script:Schemes = @('381b4222-f694-41f0-9685-ff5bb260df2e', 'duplicate-ok') }
            Enable-HighPerformancePower | Should -Be '11111111-2222-3333-4444-555555555555'
            $calls = Get-CallLog
            $calls | Should -Contain 'powercfg /setactive 11111111-2222-3333-4444-555555555555'
        }

        It 'falls back to the best performance mode without the plan' {
            InModuleScope FotoboxProvision { $script:Schemes = @('381b4222-f694-41f0-9685-ff5bb260df2e') }
            Enable-HighPerformancePower | Should -Be 'overlay'
            $calls = Get-CallLog
            $calls | Should -Contain 'powercfg /overlaysetactive ded574b5-45a0-4f42-8737-46345c09c238'
        }

        It 'skips settings the device does not have' {
            InModuleScope FotoboxProvision { $script:MissingSettings = @('LIDACTION') }
            { Enable-HighPerformancePower } | Should -Not -Throw
            $calls = Get-CallLog
            $calls | Should -Contain 'powercfg /setacvalueindex SCHEME_CURRENT SUB_VIDEO VIDEOIDLE 0'
        }
    }

    Context 'settings file' {
        It 'merges folders into the settings and keeps arrays' {
            $json = ConvertTo-ProvisionedSettingsJson -Settings @{ layouts = @('Einzelbild'); autoStart = $true } `
                -Directories @{ Photos = 'D:\Fotos'; Collages = 'D:\Collagen' } | ConvertFrom-Json
            $json.settings.photoDirectory | Should -Be 'D:\Fotos'
            $json.settings.collageDirectory | Should -Be 'D:\Collagen'
            $json.settings.autoStart | Should -BeTrue
            , $json.settings.layouts | Should -BeOfType [array]
            $json.settings.layouts | Should -Be @('Einzelbild')
        }
    }

    Context 'provisioning' {
        It 'runs every step in order' {
            $result = Invoke-FotoboxProvisioning -Config $script:config -SetupPath 'C:\Setup\Fotobox_1.0.0_x64-setup.exe'

            $calls = Get-CallLog
            $calls | Should -Contain 'timezone W. Europe Standard Time'
            $calls | Should -Contain 'rename FOTOBOX'
            $calls | Should -Contain 'setup C:\Setup\Fotobox_1.0.0_x64-setup.exe /S /KIOSK=1 /KIOSKUSER=Booth /LANTOKEN=none'
            $calls | Should -Contain 'mkdir C:\Fotobox\Fotos'
            $calls | Should -Contain 'icacls.exe C:\Fotobox\Fotos /grant Booth:(OI)(CI)M'
            # Power plan first, so the kiosk setup tunes the active plan.
            $calls.IndexOf('powercfg /hibernate off') | Should -BeLessThan ([array]::FindIndex($calls, [Predicate[string]] { param($c) $c -like 'setup *' }))

            $result.KioskUser | Should -Be 'Booth'
            $settings = (Get-Content -LiteralPath $result.ProvisioningFile -Raw | ConvertFrom-Json).settings
            $settings.camera | Should -Be 'sony'
            $settings.shutterTimeout | Should -Be 3
            $settings.photoDirectory | Should -Be 'C:\Fotobox\Fotos'
        }

        It 'adds Wi-Fi and a printer driver relative to the setup folder' {
            $script:config.Wifi = @{ Ssid = 'Booth & Co'; Password = 'secret' }
            $script:config.PrinterDriverInf = 'drivers\printer.inf'
            Invoke-FotoboxProvisioning -Config $script:config -SetupPath 'C:\Setup\Fotobox-setup.exe' -BaseDir 'C:\Setup' | Out-Null

            $calls = Get-CallLog
            @($calls | Where-Object { $_ -like 'netsh.exe wlan add profile filename=* user=all' }).Count | Should -Be 1
            $calls | Should -Contain "pnputil.exe /add-driver $([System.IO.Path]::Combine('C:\Setup', 'drivers\printer.inf')) /install"
        }

        It 'stops when the setup fails' {
            InModuleScope FotoboxProvision { $script:SetupExitCode = 2 }
            { Invoke-FotoboxProvisioning -Config $script:config -SetupPath 'C:\Setup\Fotobox-setup.exe' } |
                Should -Throw '*exit code 2*'
            Test-Path (Join-Path $env:ProgramData 'Fotobox\provisioning.json') | Should -BeFalse
        }
    }
}
