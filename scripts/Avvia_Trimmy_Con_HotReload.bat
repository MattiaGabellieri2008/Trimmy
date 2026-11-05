@echo off
title Trimmy - Flutter Live Debug e Hot Reload
color 0e

echo ==========================================================
echo        TRIMMY - FLUTTER RUN CON HOT RELOAD
echo ==========================================================
echo.

set ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe
set EMULATOR=%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe
set AVD_DIR=%USERPROFILE%\.android\avd\Pixel_9_Pro_XL.avd
set PROJECT_DIR=C:\Users\mattia.gabellieri_ma\Desktop\Gestionale saloni\Trimmy\Frontend

del /f /q "%AVD_DIR%\*.lock" 2>nul

"%ADB%" devices | findstr /i "emulator-" >nul
if %ERRORLEVEL% NEQ 0 (
    echo Avvio dell'emulatore Pixel 9 Pro XL...
    start "" "%EMULATOR%" -avd Pixel_9_Pro_XL
    echo In attesa dell'avvio di Android...
    "%ADB%" wait-for-device
    :WAIT_BOOT_HOT
    for /f %%a in ('"%ADB%" shell getprop sys.boot_completed') do (
        if "%%a"=="1" goto BOOT_HOT_OK
    )
    timeout /t 2 /nobreak >nul
    goto WAIT_BOOT_HOT
    :BOOT_HOT_OK
)

"%ADB%" shell wm dismiss-keyguard
"%ADB%" shell input keyevent 82

cd /d "%PROJECT_DIR%"
echo Avvio in modalita' interattiva (premi 'r' per Hot Reload, 'R' per Hot Restart)...
call flutter run -d emulator-5554
pause
