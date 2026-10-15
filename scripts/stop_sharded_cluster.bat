@echo off
title Stop MongoDB Sharded Cluster
cd /d "%~dp0.."
echo ==========================================================
echo Gracefully Stopping Sharded Cluster Nodes
echo ==========================================================

python scripts\stop_nodes.py 27050 27200 27300 27100
if errorlevel 1 (
    "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" scripts\stop_nodes.py 27050 27200 27300 27100
)
pause
