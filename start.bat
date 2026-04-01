@echo off
cd /d "%~dp0"
echo Starting PostFlow...
start "" cmd /k "npm run dev"

echo Waiting for server to start...
:wait
timeout /t 2 /nobreak >nul
curl -s http://localhost:5173 >nul 2>&1
if %errorlevel% neq 0 goto wait

start "" "http://localhost:5173"
echo Done! PostFlow is open in your browser.
