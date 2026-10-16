@echo off
title Distributed Database Library Management System
cd /d "%~dp0"
echo Starting Distributed Database Library Management System...
python app\main.py
if errorlevel 1 (
    echo.
    echo Trying Python 3.10 or py launcher...
    if exist "%LOCALAPPDATA%\Programs\Python\Python310\python.exe" (
        "%LOCALAPPDATA%\Programs\Python\Python310\python.exe" app\main.py
    ) else if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
        "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" app\main.py
    ) else (
        py -3 app\main.py
    )
)
pause
