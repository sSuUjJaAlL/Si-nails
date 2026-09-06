@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title SiNails Studio Launcher
color 0F

echo.
echo ============================================
echo   SiNails Studio - Clean Start
echo ============================================
echo.
echo Project: %CD%
echo.

if not exist "package.json" (
  echo ERROR: package.json not found. Run this script from the SiNails project root.
  pause
  exit /b 1
)

if not exist ".env" (
  echo ERROR: .env file is missing.
  echo Copy .env.example to .env and set DATABASE_URL, JWT_SECRET, and PORT.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
  )
)

echo Checking environment variables...
call npx --yes tsx scripts/check-env.ts
if errorlevel 1 (
  pause
  exit /b 1
)

echo.
echo --------------------------------------------
echo   FREEING PORTS 5000 / 5173...
echo --------------------------------------------
powershell -NoProfile -Command "foreach ($port in 5000,5173) { Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object { try { Stop-Process -Id $_.OwningProcess -Force -ErrorAction Stop; Write-Host ('Stopped PID ' + $_.OwningProcess + ' on port ' + $port) } catch {} } }"
timeout /t 1 /nobreak >nul

echo.
echo --------------------------------------------
echo   DATABASE
echo --------------------------------------------
if /I "%KEEP_DATA%"=="1" (
  echo KEEP_DATA=1 set - keeping existing accounts/data.
) else (
  echo Wiping accounts/data so first open shows Admin setup...
  echo To keep data next time: set KEEP_DATA=1 ^&^& start.bat
  call npx --yes tsx scripts/reset-db.ts
  if errorlevel 1 (
    echo ERROR: Database reset failed.
    pause
    exit /b 1
  )
  echo Database cleared. Open the app and create the Admin account first.
)

echo.
echo --------------------------------------------
echo   STARTING BACKEND...
echo --------------------------------------------
echo Backend API: http://localhost:5000
start "SiNails Backend" cmd /k "cd /d ""%~dp0"" && set PORT=5000&& set NODE_ENV=development&& npx --yes tsx watch server/index.ts"

timeout /t 2 /nobreak >nul

echo.
echo --------------------------------------------
echo   STARTING FRONTEND...
echo --------------------------------------------
echo Frontend: http://localhost:5173
start "SiNails Frontend" cmd /k "cd /d ""%~dp0"" && npx --yes vite --port 5173"

echo.
echo ============================================
echo   SiNails is starting
echo ============================================
echo.
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:5000
echo   API:      http://localhost:5000/api
echo.
echo   First visit with empty DB:
echo     http://localhost:5173/setup
echo.
echo   Two terminal windows were opened for logs.
echo   Close those windows to stop the servers.
echo ============================================
echo.
pause
endlocal
