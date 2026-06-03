@echo off
setlocal

cd /d "%~dp0"

echo Starting MoaPDF desktop app...
echo.

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo npm.cmd was not found. Please install Node.js or add npm to PATH.
  echo.
  pause
  exit /b 1
)

call npm.cmd run tauri:dev
set EXIT_CODE=%ERRORLEVEL%

if not "%EXIT_CODE%"=="0" (
  echo.
  echo MoaPDF failed to start. Exit code: %EXIT_CODE%
  echo.
  pause
  exit /b %EXIT_CODE%
)

endlocal
