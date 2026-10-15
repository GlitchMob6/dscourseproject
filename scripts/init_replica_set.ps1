# ==============================================================================
# Script: init_replica_set.ps1
# Purpose: Initiate Replica Set 'rs0' by connecting to port 27018
# ==============================================================================

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$cmd = Get-Command mongosh -ErrorAction SilentlyContinue
$mongoshPath = if ($cmd) { $cmd.Source } else { "mongosh.exe" }

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Initiating Replica Set rs0 on localhost:27018" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$pyCmd = Get-Command python -ErrorAction SilentlyContinue
$pyExe = if ($pyCmd) { $pyCmd.Source } else { "python.exe" }

$scriptPath = Join-Path $PSScriptRoot "init_replica_set.py"
& $pyExe $scriptPath
