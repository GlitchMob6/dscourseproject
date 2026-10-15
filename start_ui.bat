@echo off
title Distributed Library Management System - UI Launcher
echo =====================================================================
echo   Starting Distributed Library Management System UI Layer
echo =====================================================================
echo.

:: 1. Start FastAPI Backend in a new terminal window
echo [1/2] Starting FastAPI Backend on http://127.0.0.1:8000 ...
start "Distributed DB - FastAPI Backend" cmd /k "cd /d %~dp0 && python -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload"

:: 2. Wait 2 seconds for API to initialize
timeout /t 2 /nobreak >nul

:: 3. Start React + Vite Frontend
echo [2/2] Starting React + Vite Frontend on http://localhost:5173 ...
start "Distributed DB - React Frontend" cmd /k "cd /d %~dp0\frontend && npm run dev"

echo.
echo =====================================================================
echo   Both services are starting!
echo   Frontend:  http://localhost:5173
echo   API Docs:  http://127.0.0.1:8000/docs
echo =====================================================================
echo.
timeout /t 3 >nul
start http://localhost:5173
