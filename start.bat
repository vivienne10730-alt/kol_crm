@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo  KOL CRM Starting...
echo.

python app.py
pause
