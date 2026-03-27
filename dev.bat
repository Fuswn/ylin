@echo off
echo Starting Markdown Editor (dev mode)...
cd /d %~dp0
set PATH=%USERPROFILE%\.cargo\bin;%PATH%
npx tauri dev
