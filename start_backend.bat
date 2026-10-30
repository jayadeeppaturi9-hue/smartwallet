@echo off
setlocal
cd /d "%~dp0\backend"

if not exist "venv\Scripts\python.exe" (
    echo ERROR: Python virtual environment not found.
    echo Run setup.bat first to create the backend environment.
    exit /b 1
)

call venv\Scripts\activate.bat
python manage.py runserver
endlocal
