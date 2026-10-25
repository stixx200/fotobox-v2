@{
    Severity     = @('Error', 'Warning')
    ExcludeRules = @(
        # Internal helpers of FotoboxKiosk.psm1 are only called by its entry
        # points, which log every change; -WhatIf is not offered for them.
        # Also flags pure generators like New-KioskPassword.
        'PSUseShouldProcessForStateChangingFunctions'
    )
    Rules        = @{
        # The installer runs the scripts with Windows PowerShell 5.1.
        PSUseCompatibleSyntax = @{ Enable = $true; TargetVersions = @('5.1', '7.4') }
    }
}
