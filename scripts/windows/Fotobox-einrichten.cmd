@echo off
rem Fotobox: richtet diesen PC als Fotobox ein (fragt nach Administratorrechten).
rem Details und Log: provision-fotobox.ps1, C:\ProgramData\Fotobox\provision.log
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0provision-fotobox.ps1" -Restart
