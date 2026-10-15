@echo off
title Stop MongoDB Replica Set
cd /d "%~dp0.."
echo ==========================================================
echo Gracefully Stopping Replica Set Nodes (27018, 27019, 27020)
echo ==========================================================

python scripts\stop_nodes.py 27018 27019 27020
if errorlevel 1 (
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" scripts\stop_nodes.py 27018 27019 27020
)
pause
