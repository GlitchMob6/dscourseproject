@echo off
title Distributed Database Library Management System
cd /d "%~dp0"
echo Starting Distributed Database Library Management System...
python app\main.py
if errorlevel 1 (
    echo.
    echo Trying direct Python path...
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" app\main.py
)
pause
