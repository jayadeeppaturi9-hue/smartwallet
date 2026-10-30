@echo off
setlocal
cd /d "%~dp0"

start "Smart Wallet-to-VASP Backend" cmd /k "call start_backend.bat"
start "Smart Wallet-to-VASP Frontend" cmd /k "call start_frontend.bat"

echo Backend and frontend startup commands launched in separate terminals.
echo Frontend: http://localhost:5173
echo Backend: http://localhost:8000
endlocal
