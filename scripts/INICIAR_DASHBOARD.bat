@echo off
setlocal
cd /d "%~dp0\.."

call scripts\BUILD_REACT.bat
if errorlevel 1 exit /b %errorlevel%

python scripts\dev.py
