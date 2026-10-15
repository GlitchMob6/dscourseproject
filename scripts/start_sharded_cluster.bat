@echo off
title MongoDB Sharded Cluster - Stage B
cd /d "%~dp0.."
echo ==========================================================
echo Starting Stage B: MongoDB Sharded Cluster Nodes
echo ==========================================================

python scripts\start_sharded_cluster.py
if errorlevel 1 (
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" scripts\start_sharded_cluster.py
)
if errorlevel 1 (
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_sharded_cluster.ps1"
)
pause
