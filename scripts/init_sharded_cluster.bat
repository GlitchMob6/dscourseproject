@echo off
title MongoDB Sharded Cluster Initializer
cd /d "%~dp0.."
echo ==========================================================
echo Initializing Stage B Sharded Cluster Components
echo ==========================================================

python scripts\init_sharded_cluster.py
if errorlevel 1 (
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" scripts\init_sharded_cluster.py
)
if errorlevel 1 (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0init_sharded_cluster.ps1"
)
pause
