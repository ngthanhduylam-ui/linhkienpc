@echo off
setlocal

cd /d "%~dp0" || (
  echo Khong the chuyen vao thu muc helper.
  pause
  exit /b 1
)

set "VBS_PATH=%~dp0start-helper-hidden.vbs"
set "SHORTCUT_NAME=Phuoc Tai Cho Tot Helper.lnk"
set "STARTUP_SHORTCUT=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\%SHORTCUT_NAME%"

if not exist "%VBS_PATH%" (
  echo Khong tim thay start-helper-hidden.vbs.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$shortcutPath = [Environment]::ExpandEnvironmentVariables('%STARTUP_SHORTCUT%'); $targetPath = [Environment]::ExpandEnvironmentVariables('%VBS_PATH%'); $shell = New-Object -ComObject WScript.Shell; $shortcut = $shell.CreateShortcut($shortcutPath); $shortcut.TargetPath = $targetPath; $shortcut.WorkingDirectory = Split-Path -Parent $targetPath; $shortcut.WindowStyle = 7; $shortcut.Description = 'Start Phuoc Tai Cho Tot helper'; $shortcut.Save()"
if errorlevel 1 (
  echo Tao shortcut Startup that bai.
  pause
  exit /b 1
)

echo Da cai tu khoi dong cung Windows:
echo "%STARTUP_SHORTCUT%"
echo Helper se chay an khi nguoi dung dang nhap Windows.
pause
exit /b 0
