@echo off
setlocal

title Phuoc Tai Cho Tot Helper
cd /d "%~dp0" || (
  echo Khong the chuyen vao thu muc helper.
  pause
  exit /b 1
)

if not exist ".runtime" mkdir ".runtime" >nul 2>nul
call :log "Starting helper launcher"

where node >nul 2>nul
if errorlevel 1 (
  echo Khong tim thay Node.js. Vui long cai Node.js 18 hoac moi hon.
  call :log "Node.js not found"
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo Khong tim thay npm. Vui long cai Node.js kem npm.
  call :log "npm not found"
  pause
  exit /b 1
)

call :is_helper_running
if not errorlevel 1 (
  echo Cho Tot helper dang chay tai http://127.0.0.1:17321
  call :log "Cho Tot helper already running"
  timeout /t 3 /nobreak >nul
  exit /b 0
)

if not exist "node_modules" (
  echo Chua co node_modules. Dang chay npm install...
  call :log "node_modules missing; running npm install"
  call npm.cmd install
  if errorlevel 1 (
    echo npm install that bai. Vui long xem loi o tren.
    call :log "npm install failed"
    pause
    exit /b 1
  )
)

echo Dang chay Cho Tot helper tai http://127.0.0.1:17321
echo Co the thu nho cua so nay, nhung dung dong khi dang chuan bi tin.
call :log "Running npm.cmd run start"
call npm.cmd run start
if errorlevel 1 (
  echo Helper da dung voi loi. Vui long xem noi dung o tren.
  call :log "Helper exited with error"
  pause
  exit /b 1
)

echo Helper da dung.
call :log "Helper exited"
pause
exit /b 0

:is_helper_running
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:17321/health' -TimeoutSec 2; if ($r.StatusCode -eq 200) { exit 0 } exit 1 } catch { exit 1 }"
exit /b %errorlevel%

:log
echo [%date% %time%] %~1>>".runtime\helper-launch.log"
exit /b 0
