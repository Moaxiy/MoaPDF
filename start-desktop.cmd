@echo off
setlocal

cd /d "%~dp0"

set "LOCAL_APP=%LOCALAPPDATA%\MoaPDF\MoaPDF.exe"
set "LOCAL_PROGRAM_APP=%LOCALAPPDATA%\Programs\MoaPDF\MoaPDF.exe"
set "PROGRAM_APP=%ProgramFiles%\MoaPDF\MoaPDF.exe"

if exist "%LOCAL_APP%" (
  start "" "%LOCAL_APP%"
  exit /b 0
)

if exist "%LOCAL_PROGRAM_APP%" (
  start "" "%LOCAL_PROGRAM_APP%"
  exit /b 0
)

if exist "%PROGRAM_APP%" (
  start "" "%PROGRAM_APP%"
  exit /b 0
)

where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo powershell.exe was not found.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm.cmd was not found. Please install Node.js or add npm to PATH.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "$npm=(Get-Command npm.cmd).Source; Start-Process -FilePath $npm -ArgumentList 'run','tauri:dev' -WorkingDirectory '%CD%' -WindowStyle Hidden"

endlocal
