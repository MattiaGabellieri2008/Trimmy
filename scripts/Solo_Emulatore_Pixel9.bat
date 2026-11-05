@echo off
title Pixel 9 Pro XL - Solo Emulatore
color 0a

echo ==========================================================
echo        AVVIO SOLO EMULATORE PIXEL 9 PRO XL
echo ==========================================================
echo.

set ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe
set EMULATOR=%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe
set AVD_DIR=%USERPROFILE%\.android\avd\Pixel_9_Pro_XL.avd

echo Pulizia lock orfani in corso...
del /f /q "%AVD_DIR%\*.lock" 2>nul

"%ADB%" devices | findstr /i "emulator-" >nul
if %ERRORLEVEL% EQU 0 (
    echo Emulatore gia' in esecuzione!
) else (
    echo Avvio dell'emulatore Pixel 9 Pro XL...
    start "" "%EMULATOR%" -avd Pixel_9_Pro_XL
)

echo.
echo Operazione completata! Questa finestra si chiudera' a breve.
timeout /t 4 >nul
