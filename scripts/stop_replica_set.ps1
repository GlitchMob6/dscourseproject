# ==============================================================================
# Script: stop_replica_set.ps1
# Purpose: Gracefully shut down 3 Replica Set nodes on ports 27018, 27019, 27020
# ==============================================================================

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Gracefully Stopping MongoDB Replica Set (rs0)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$pyCmd = Get-Command python -ErrorAction SilentlyContinue
$pyExe = if ($pyCmd) { $pyCmd.Source } else { "python.exe" }

$scriptPath = Join-Path $PSScriptRoot "stop_nodes.py"
& $pyExe $scriptPath 27018 27019 27020

Start-Sleep -Seconds 2

# Verify all ports are closed
$ports = @(27018, 27019, 27020)
foreach ($port in $ports) {
    $conn = Test-NetConnection -ComputerName 127.0.0.1 -Port $port -WarningAction SilentlyContinue
    if (-not $conn.TcpTestSucceeded) {
        Write-Host " [STOPPED] Port $port is closed." -ForegroundColor Green
    } else {
        Write-Host " [WARNING] Port $port is still listening." -ForegroundColor Yellow
    }
}

Write-Host "`nReplica set nodes have been stopped." -ForegroundColor Green
