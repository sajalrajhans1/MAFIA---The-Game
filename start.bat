@echo off
REM Starts a tiny local web server for MAFIA and opens the game.
REM Needs Python 3 (python.org) or Node.js (nodejs.org) installed.
cd /d "%~dp0"
where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8080
  python serve.py 8080
  goto :eof
)
where npx >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:8080
  npx --yes http-server -p 8080 -c-1 .
  goto :eof
)
echo Could not find Python or Node.js. Install one of them, or upload this folder to any static web host.
pause
