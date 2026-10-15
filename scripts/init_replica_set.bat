@echo off
title MongoDB Replica Set Initializer
cd /d "%~dp0.."
echo ==========================================================
echo Initiating Stage A Replica Set (rs0)
echo ==========================================================

python scripts\init_replica_set.py
if errorlevel 1 (
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" scripts\init_replica_set.py
)
if errorlevel 1 (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0init_replica_set.ps1"
)
pause
