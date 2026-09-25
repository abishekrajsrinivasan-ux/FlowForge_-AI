@echo off
echo Starting FLOWFORGE AI dev server...
cd /d "%~dp0"
node node_modules/vite/bin/vite.js
pause
