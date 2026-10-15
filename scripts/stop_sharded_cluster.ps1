# ==============================================================================
# Script: stop_sharded_cluster.ps1
# Purpose: Gracefully shut down mongos router and all shard nodes
# Ports: 27050 (mongos), 27200 (shard1), 27300 (shard2), 27100 (config)
# ==============================================================================

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Gracefully Stopping MongoDB Sharded Cluster" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$pyCmd = Get-Command python -ErrorAction SilentlyContinue
$pyExe = if ($pyCmd) { $pyCmd.Source } else { "python.exe" }

$scriptPath = Join-Path $PSScriptRoot "stop_nodes.py"
& $pyExe $scriptPath 27050 27200 27300 27100
Start-Sleep -Seconds 2

@(27050, 27200, 27300, 27100) | ForEach-Object {
    $c = Test-NetConnection -ComputerName 127.0.0.1 -Port $_ -WarningAction SilentlyContinue
    if (-not $c.TcpTestSucceeded) {
        Write-Host " [STOPPED] Port $_ is closed." -ForegroundColor Green
    } else {
        Write-Host " [WARNING] Port $_ is still open." -ForegroundColor Yellow
    }
}

Write-Host "`nSharded cluster nodes stopped." -ForegroundColor Green
