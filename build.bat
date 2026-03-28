@echo off
echo ============================================
echo    ylin - Tauri Build Script
echo ============================================
echo.

REM Setup MSVC environment
call "C:\Program Files\Microsoft Visual Studio\2022\Community\VC\Auxiliary\Build\vcvars64.bat" >nul 2>&1

REM Add cargo to PATH
set PATH=%USERPROFILE%\.cargo\bin;%PATH%

REM Build
echo Building...
cd /d %~dp0
npx tauri build 2>&1

if %errorlevel% equ 0 (
    echo.
    echo ============================================
    echo   Build Successful!
    echo   EXE: src-tauri\target\release\ylin.exe
    echo ============================================
) else (
    echo.
    echo Build failed with error code %errorlevel%
)

pause
