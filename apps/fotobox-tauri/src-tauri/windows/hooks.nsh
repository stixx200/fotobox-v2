; Fotobox installer hooks (Tauri NSIS bundle, perMachine install).
;
; After installing, configure the PC in kiosk mode (booth starts automatically
; after Windows starts) or as a normal install by running setup-kiosk.ps1,
; which is bundled next to Fotobox.exe. See scripts/windows/FotoboxKiosk.psm1.
;
; The first install asks for the mode (silent: normal). Running a newer setup
; later (update) keeps the mode, kiosk user and tablet token.
;
; Command line (e.g. `Fotobox_1.0.0_x64-setup.exe /S /KIOSK=1`):
;   /KIOSK=1|0             switch to kiosk or normal mode
;   /KIOSKUSER=name        Windows account for the kiosk (default: Fotobox)
;   /LANTOKEN=auto|none|x  tablet mode with a generated/given token, or off
;
; Runs inside Tauri's Install/Uninstall sections, so FileFunc (GetOptions),
; LogicLib, x64.nsh, $UpdateMode and $AppStartMenuFolder are available.

!define FOTOBOX_REGKEY "Software\Fotobox"

; 64-bit PowerShell: the installer is a 32-bit process, and the 32-bit
; PowerShell would write HKLM\SOFTWARE values into WOW6432Node.
!macro FOTOBOX_POWERSHELL OUTVAR
  ${If} ${RunningX64}
    StrCpy ${OUTVAR} "$WINDIR\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
  ${Else}
    StrCpy ${OUTVAR} "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe"
  ${EndIf}
!macroend

; HKLM\Software\Fotobox is written by the 64-bit PowerShell; read and delete
; it in the 64-bit registry view, then return to the template's default view.
!macro FOTOBOX_REGVIEW_NATIVE
  ${If} ${RunningX64}
    SetRegView 64
  ${EndIf}
!macroend

; Runs setup-kiosk.ps1 with ARGS; leaves the exit code (or "error") in $R8.
!macro FOTOBOX_RUN_SETUP ARGS
  !insertmacro FOTOBOX_POWERSHELL $R9
  DetailPrint "Fotobox: setup-kiosk.ps1 ${ARGS}"
  nsExec::ExecToLog '"$R9" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$INSTDIR\setup-kiosk.ps1" -InstallDir "$INSTDIR" ${ARGS}'
  Pop $R8
!macroend

!macro NSIS_HOOK_POSTINSTALL
  ; --- Mode: command line > previous install (updates) > question > normal
  !insertmacro FOTOBOX_REGVIEW_NATIVE
  ReadRegStr $R0 HKLM "${FOTOBOX_REGKEY}" "SetupMode"
  ReadRegStr $R1 HKLM "${FOTOBOX_REGKEY}" "KioskUser"
  SetRegView default
  ${If} $R1 == ""
    StrCpy $R1 "Fotobox"
  ${EndIf}
  StrCpy $R2 "keep"

  ClearErrors
  ${GetOptions} $CMDLINE "/KIOSK=" $R3
  ${IfNot} ${Errors}
    ${If} $R3 == "1"
      StrCpy $R0 "Kiosk"
    ${Else}
      StrCpy $R0 "Normal"
    ${EndIf}
  ${ElseIf} $R0 == ""
    ; First install: ask (silent installs default to normal mode).
    ${If} ${Silent}
      StrCpy $R0 "Normal"
    ${Else}
      MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 \
        "Diesen PC als Fotobox-Kiosk einrichten?$\r$\n$\r$\n\
Ja: Windows meldet beim Start automatisch den Benutzer $\"$R1$\" an und startet die Fotobox im Vollbild. \
Energiesparmodus, Sperrbildschirm und Benachrichtigungen werden deaktiviert.$\r$\n$\r$\n\
Nein: Normale Installation (die Fotobox wird von Hand gestartet)." \
        /SD IDNO IDYES fotobox_kiosk_yes
      StrCpy $R0 "Normal"
      Goto fotobox_mode_done
      fotobox_kiosk_yes:
      StrCpy $R0 "Kiosk"
      fotobox_mode_done:
    ${EndIf}
  ${EndIf}

  ClearErrors
  ${GetOptions} $CMDLINE "/KIOSKUSER=" $R3
  ${IfNot} ${Errors}
  ${AndIf} $R3 != ""
    StrCpy $R1 $R3
  ${EndIf}
  ClearErrors
  ${GetOptions} $CMDLINE "/LANTOKEN=" $R3
  ${IfNot} ${Errors}
  ${AndIf} $R3 != ""
    StrCpy $R2 $R3
  ${EndIf}

  ; --- Configure (idempotent; re-applies the stored mode on updates)
  !insertmacro FOTOBOX_RUN_SETUP '-Mode $R0 -KioskUser "$R1" -LanToken "$R2"'
  ${If} $R8 != "0"
    MessageBox MB_OK|MB_ICONEXCLAMATION \
      "Die Fotobox wurde installiert, aber die Einrichtung ($R0) ist nicht vollständig.$\r$\n\
Details: %ProgramData%\Fotobox\setup.log$\r$\n$\r$\n\
Sie können sie später über das Startmenü erneut ausführen." /SD IDOK
  ${EndIf}

  ; (setup-kiosk.ps1 stores SetupMode/KioskUser under HKLM\Software\Fotobox.)

  ; --- Start menu: re-run or undo the kiosk setup (asks for admin rights)
  !insertmacro FOTOBOX_POWERSHELL $R9
  !insertmacro MUI_STARTMENU_GETFOLDER Application $R7
  CreateDirectory "$SMPROGRAMS\$R7"
  CreateShortCut "$SMPROGRAMS\$R7\Fotobox Kiosk einrichten.lnk" "$R9" \
    '-NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\setup-kiosk.ps1" -Mode Kiosk -KioskUser "$R1"' \
    "$INSTDIR\Fotobox.exe" 0
  CreateShortCut "$SMPROGRAMS\$R7\Fotobox Kiosk deaktivieren.lnk" "$R9" \
    '-NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\setup-kiosk.ps1" -Mode Normal' \
    "$INSTDIR\Fotobox.exe" 0

  ; Kiosk settings (auto-logon, lockdown) take effect after a restart; the
  ; finish page offers it (never forced for silent installs).
  ${If} $R0 == "Kiosk"
    SetRebootFlag true
  ${EndIf}
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ${If} $UpdateMode <> 1
    StrCpy $R0 ""
    !insertmacro FOTOBOX_REGVIEW_NATIVE
    ReadRegStr $R1 HKLM "${FOTOBOX_REGKEY}" "KioskUser"
    SetRegView default
    ${If} $R1 != ""
    ${AndIfNot} ${Silent}
      MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 \
        "Auch den Windows-Benutzer $\"$R1$\" mit allen Fotos und Einstellungen der Fotobox löschen?" \
        /SD IDNO IDNO fotobox_keep_user
      StrCpy $R0 "-RemoveKioskUser"
      fotobox_keep_user:
    ${EndIf}
    !insertmacro FOTOBOX_RUN_SETUP '-Uninstall $R0'

    !insertmacro MUI_STARTMENU_GETFOLDER Application $R7
    Delete "$SMPROGRAMS\$R7\Fotobox Kiosk einrichten.lnk"
    Delete "$SMPROGRAMS\$R7\Fotobox Kiosk deaktivieren.lnk"
    !insertmacro FOTOBOX_REGVIEW_NATIVE
    DeleteRegKey HKLM "${FOTOBOX_REGKEY}"
    SetRegView default
  ${EndIf}
!macroend
