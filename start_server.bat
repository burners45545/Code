@echo off
echo Starting Archive Server...

REM Check if venv311 exists first, otherwise use venv
if exist ".\venv311\Scripts\python.exe" (
    echo Using Python from venv311...
    .\venv311\Scripts\python -m pip install -r requirements.txt
    .\venv311\Scripts\python archive_server.py
) else if exist ".\venv\Scripts\python.exe" (
    echo Using Python from venv...
    .\venv\Scripts\python -m pip install -r requirements.txt
    .\venv\Scripts\python archive_server.py
) else (
    echo Error: No Python virtual environment found.
    echo Please run: python -m venv venv311
    echo Then run: .\venv311\Scripts\pip install -r requirements.txt
    pause
    exit /b 1
)

if errorlevel 1 (
    echo Error: Server failed to start.
    echo Check the logs folder for more details.
    pause
    exit /b 1
)

echo Server is running...
pause 