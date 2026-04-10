@echo off
cd /d "%~dp0"
echo Starting local server at http://localhost:8000
start "" "http://localhost:8000/index.html"

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
echo [ERROR] Neither 'py' nor 'python' is available.
echo Please install Python, then run this file again.
echo Temporary workaround: open this folder in VSCode/Cursor and use Live Server extension.
pause
