@echo off
echo Starting BoothMachine Client on port 3001...
cd /d "%~dp0"
call npm start -- -p 3001
pause
