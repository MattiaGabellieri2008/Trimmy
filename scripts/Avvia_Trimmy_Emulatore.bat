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
set APK_PATH=C:\Users\mattia.gabellieri_ma\Desktop\Gestionale saloni\Trimmy\Frontend\build\app\outputs\flutter-apk\app-debug.apk
set PROJECT_DIR=C:\Users\mattia.gabellieri_ma\Desktop\Gestionale saloni\Trimmy\Frontend

echo [1/4] Pulizia file di blocco temporanei...
if exist "%AVD_DIR%\*.lock" (
    echo     Trovati file .lock orfani. Pulizia in corso...
    del /f /q "%AVD_DIR%\*.lock"
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
    echo     In attesa dell'avvio completo di Android...
    "%ADB%" wait-for-device
    :WAIT_FOR_BOOT
    for /f %%a in ('"%ADB%" shell getprop sys.boot_completed') do (
        if "%%a"=="1" goto BOOT_OK
    )
    timeout /t 2 /nobreak >nul
    goto WAIT_FOR_BOOT
    :BOOT_OK
    echo     Sistema Android avviato e pronto!
)

echo.
echo [3/4] Sblocco dello schermo...
"%ADB%" shell wm dismiss-keyguard
"%ADB%" shell input keyevent 82

echo.
echo [4/4] Installazione e apertura app Trimmy...
if exist "%APK_PATH%" (
    echo     Installazione APK in corso...
    "%ADB%" install -r "%APK_PATH%"
) else (
    echo     Compilazione APK in corso da Flutter...
    pushd "%PROJECT_DIR%"
    call flutter build apk --debug
    popd
    "%ADB%" install -r "%APK_PATH%"
)

echo     Avvio di Trimmy sullo schermo dell'emulatore...
"%ADB%" shell am start -n com.trimmy.app/.MainActivity

echo.
echo ==========================================================
echo   APPLICAZIONE TRIMMY AVVIATA CON SUCCESSO!
echo ==========================================================
echo.
echo Puoi testare Trimmy direttamente sullo schermo del Pixel 9!
echo Premi un tasto per chiudere questa finestra...
pause >nul
