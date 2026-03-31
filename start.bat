@echo off
cd /d "%~dp0"
echo Starting PostFlow...
start "" cmd /k "npm run dev"
timeout /t 3 /nobreak >nul
start "" "http://localhost:5173"
