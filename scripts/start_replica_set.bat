@echo off
title MongoDB Replica Set - Stage A
cd /d "%~dp0.."
echo ==========================================================
echo Starting Stage A: MongoDB 3-Node Replica Set (rs0)
echo ==========================================================

python scripts\start_replica_set.py
if errorlevel 1 (
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" scripts\start_replica_set.py
)
if errorlevel 1 (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_replica_set.ps1"
)
pause
