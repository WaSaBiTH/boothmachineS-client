@echo off
echo Starting BoothMachine Client on port 3500...
cd /d "%~dp0"
call npm start -- -p 3500
pause
