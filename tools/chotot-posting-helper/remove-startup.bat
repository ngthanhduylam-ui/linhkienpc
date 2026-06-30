@echo off
setlocal

set "SHORTCUT_NAME=Phuoc Tai Cho Tot Helper.lnk"
set "STARTUP_SHORTCUT=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\%SHORTCUT_NAME%"

if exist "%STARTUP_SHORTCUT%" (
  del "%STARTUP_SHORTCUT%"
  if errorlevel 1 (
    echo Khong xoa duoc shortcut Startup.
    pause
    exit /b 1
  )
  echo Da xoa shortcut Startup:
  echo "%STARTUP_SHORTCUT%"
) else (
  echo Khong tim thay shortcut Startup. Khong co gi can xoa.
)

pause
exit /b 0
