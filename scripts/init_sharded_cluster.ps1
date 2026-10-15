# ==============================================================================
# Script: init_sharded_cluster.ps1
# Purpose: Initiate config and shard replica sets, launch mongos on port 27050,
#          and register shards and database collection sharding.
# ==============================================================================

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$foundMongos = Get-ChildItem -Path "C:\Program Files\MongoDB\Server" -Filter "mongos.exe" -Recurse -Depth 2 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName -First 1
if ($foundMongos) {
    $mongosPath = $foundMongos
} else {
    $mongosCmd = Get-Command mongos -ErrorAction SilentlyContinue
    if ($mongosCmd) { $mongosPath = $mongosCmd.Source } else { $mongosPath = "mongos.exe" }
}

$pyCmd = Get-Command python -ErrorAction SilentlyContinue
$pyExe = if ($pyCmd) { $pyCmd.Source } else { "python.exe" }

$mongoshCmd = Get-Command mongosh -ErrorAction SilentlyContinue
$mongoshPath = if ($mongoshCmd) { $mongoshCmd.Source } else { "mongosh.exe" }

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Initializing Sharded Cluster Components" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$scriptPath = Join-Path $PSScriptRoot "init_sharded_cluster.py"
& $pyExe $scriptPath
