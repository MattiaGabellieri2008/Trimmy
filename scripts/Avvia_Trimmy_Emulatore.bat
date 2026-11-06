@echo off
title Trimmy - Avvio Emulatore Android e App
color 0b

echo ==========================================================
echo        TRIMMY - AVVIO EMULATORE E APP ANDROID
echo ==========================================================
echo.

set ADB=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe
set EMULATOR=%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe
set AVD_DIR=%USERPROFILE%\.android\avd\Pixel_9_Pro_XL.avd
set PROJECT_DIR=%~dp0..\Frontend
if not exist "%PROJECT_DIR%" (
    set PROJECT_DIR=C:\Users\mattia.gabellieri_ma\Desktop\Gestionale saloni\Trimmy\Frontend
)
set APK_PATH=%PROJECT_DIR%\build\app\outputs\flutter-apk\app-debug.apk

echo [1/4] Pulizia file di blocco temporanei dell'emulatore...
if exist "%AVD_DIR%\*.lock" (
    echo     Trovati file .lock orfani. Pulizia in corso...
    del /f /q "%AVD_DIR%\*.lock" 2>nul
    echo     File .lock rimossi con successo!
) else (
    echo     Nessun file .lock orfano rilevato.
)

echo.
echo [2/4] Controllo stato emulatore Pixel 9 Pro XL...
"%ADB%" devices | findstr /i "emulator-" >nul
if %ERRORLEVEL% EQU 0 (
    echo     Emulatore gia' attivo e pronto!
) else (
    echo     Avvio del Pixel 9 Pro XL in corso...
    start "" "%EMULATOR%" -avd Pixel_9_Pro_XL
    echo     In attesa dell'avvio completo di Android (attendere prego)...
    "%ADB%" wait-for-device
    :WAIT_FOR_BOOT
    for /f %%a in ('"%ADB%" shell getprop sys.boot_completed 2^>nul') do (
        if "%%a"=="1" goto BOOT_OK
    )
    timeout /t 2 /nobreak >nul
    goto WAIT_FOR_BOOT
    :BOOT_OK
    echo     Sistema Android avviato e pronto!
)

echo.
echo [3/4] Sblocco dello schermo dell'emulatore...
"%ADB%" shell wm dismiss-keyguard 2>nul
"%ADB%" shell input keyevent 82 2>nul

echo.
echo [4/4] Avvio dell'app Trimmy...
echo.
echo Scegli come vuoi avviare Trimmy:
echo   [1] Avvio con Hot Reload interattivo (Consigliato per sviluppo, premi 'r' per ricaricare)
echo   [2] Compilazione APK veloce ed esecuzione standalone sullo schermo
echo   [3] Solo emulatore (non avviare l'app)
echo.
echo Avvio automatico opzione [1] tra 5 secondi...
choice /c 123 /t 5 /d 1 /m "Seleziona un'opzione"

if errorlevel 3 goto SOLO_EMULATORE
if errorlevel 2 goto AVVIO_APK
if errorlevel 1 goto AVVIO_LIVE

:AVVIO_LIVE
echo.
echo Avvio di Flutter Live Debug su Pixel 9 Pro XL...
cd /d "%PROJECT_DIR%"
call flutter run
goto FINE

:AVVIO_APK
echo.
echo Compilazione APK con le ultime modifiche...
cd /d "%PROJECT_DIR%"
call flutter build apk --debug
echo Installazione ed esecuzione su Pixel 9...
"%ADB%" install -r "%APK_PATH%"
"%ADB%" shell am start -n com.trimmy.app/.MainActivity
echo App avviata su Pixel 9!
goto FINE

:SOLO_EMULATORE
echo Emulatore Pixel 9 pronto per l'uso.
goto FINE

:FINE
echo.
echo Premi un tasto per chiudere questa finestra...
pause >nul
