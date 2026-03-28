@echo off
echo Starting ylin (dev mode)...
cd /d %~dp0
set PATH=%USERPROFILE%\.cargo\bin;%PATH%
npx tauri dev
