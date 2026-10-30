@echo off
setlocal
cd /d "%~dp0"

rem --- Python detection ---
where py >nul 2>&1
if not errorlevel 1 (
    set PY_CMD=py -3
) else (
    where python >nul 2>&1
    if not errorlevel 1 (
        set PY_CMD=python
    ) else (
        echo ERROR: Python was not found in PATH.
        echo Install Python 3.10 or newer, then reopen VS Code and run this script again.
        exit /b 1
    )
)

rem --- Node.js detection ---
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js was not found in PATH.
    echo Install Node.js 20+ LTS and npm, then reopen VS Code and run this script again.
    exit /b 1
)

rem --- Backend virtual environment ---
if not exist "backend\venv\Scripts\python.exe" (
    echo Creating Python virtual environment in backend\venv...
    %PY_CMD% -m venv backend\venv
    if errorlevel 1 (
        echo ERROR: Python virtual environment creation failed.
        echo Install Python 3.10 or newer, then reopen VS Code and run this script again.
        exit /b 1
    )
)

if not exist "backend\venv\Scripts\python.exe" (
    echo ERROR: The backend virtual environment was not created successfully.
    exit /b 1
)

call backend\venv\Scripts\activate.bat
python -m pip install --upgrade pip
if errorlevel 1 (
    echo ERROR: pip upgrade failed in the backend virtual environment.
    exit /b 1
)
pip install -r backend\requirements.txt
if errorlevel 1 (
    echo ERROR: Python dependencies could not be installed.
    exit /b 1
)

rem --- Root frontend env file ---
if not exist ".env" if exist ".env.example" (
    echo Creating root .env from .env.example...
    copy /Y ".env.example" ".env" >nul
)

rem --- Backend env file ---
if not exist "backend\.env" if exist "backend\.env.example" (
    echo Creating backend .env from backend\.env.example...
    copy /Y "backend\.env.example" "backend\.env" >nul
)

rem --- Frontend dependencies ---
if not exist "node_modules" (
    echo Installing frontend dependencies...
    npm install
) else (
    echo Frontend dependencies already present.
)

rem --- Backend migrations ---
cd /d "%~dp0\backend"
python manage.py migrate

echo.
echo =======================================================
echo Setup complete.
echo =======================================================
echo 1) Add your real API keys to backend\.env before using blockchain features.
echo 2) Start the backend with: start_backend.bat
echo 3) Start the frontend with: start_frontend.bat

echo.
echo Optional: open the backend admin at http://localhost:8000/admin/

echo.
endlocal
