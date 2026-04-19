@echo off
cd /d "%~dp0"
echo Starting local server at http://127.0.0.1:8000/index.html
start "" "http://127.0.0.1:8000/index.html"

where node >nul 2>nul
if %errorlevel%==0 (
  node server\start-static-server.mjs
  goto :eof
)

where py >nul 2>nul
if %errorlevel%==0 (
  py -m http.server 8000
  goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
  python -m http.server 8000
  goto :eof
)

echo.
echo [ERROR] Neither 'node', 'py' nor 'python' is available.
echo Please install Node.js or Python, then run this file again.
pause
