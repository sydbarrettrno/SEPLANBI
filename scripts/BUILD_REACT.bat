@echo off
setlocal

rem Mantém o Node acessível mesmo em máquinas Windows com PATH muito extenso.
if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs;%PATH%"

call npm ci --no-audit --no-fund
if errorlevel 1 exit /b %errorlevel%

call npm run build
exit /b %errorlevel%
