@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist node_modules call npm install
set /p KENH=Ten kenh TikTok (khong co @):
node index.js %KENH%
pause
