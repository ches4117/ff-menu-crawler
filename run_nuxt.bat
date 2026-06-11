@echo off
setlocal

cd /d "%~dp0"

if not exist "node_modules" (
  echo Missing node_modules. Installing dependencies...
  call npm.cmd install
  if errorlevel 1 exit /b %errorlevel%
)

echo Nuxt app will run at:
echo http://127.0.0.1:4178
echo.
echo Press Ctrl+C in this window to stop the Nuxt server.
echo.

call npm.cmd run build
if errorlevel 1 exit /b %errorlevel%

set "HOST=127.0.0.1"
set "PORT=4178"
call npm.cmd run start
