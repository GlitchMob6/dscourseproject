# ==============================================================================
# Script: start_sharded_cluster.ps1
# Purpose: Start Config Server and Shard Data Nodes for Stage B
# Config: 27100 | Shard 1: 27200 | Shard 2: 27300
# ==============================================================================

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$foundMongod = Get-ChildItem -Path "C:\Program Files\MongoDB\Server" -Filter "mongod.exe" -Recurse -Depth 2 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName -First 1
if ($foundMongod) {
    $mongodPath = $foundMongod
} else {
    $mongodCmd = Get-Command mongod -ErrorAction SilentlyContinue
    if ($mongodCmd) { $mongodPath = $mongodCmd.Source } else { $mongodPath = "mongod.exe" }
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Starting Stage B: MongoDB Sharded Cluster Nodes" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Create directories
$dirs = @(
    "$projectRoot\data\sharding\config1",
    "$projectRoot\data\sharding\shard1",
    "$projectRoot\data\sharding\shard2",
    "$projectRoot\data\logs"
)
foreach ($d in $dirs) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}

# 1. Config Server (Port 27100)
Write-Host "[1/3] Starting Config Server on port 27100 (cfg-rs)..." -ForegroundColor Yellow
Start-Process -FilePath $mongodPath -ArgumentList `
    "--configsvr", `
    "--replSet cfg-rs", `
    "--port 27100", `
    "--dbpath `"$projectRoot\data\sharding\config1`"", `
    "--logpath `"$projectRoot\data\logs\config1.log`"", `
    "--wiredTigerCacheSizeGB 0.25", `
    "--bind_ip 127.0.0.1" -WindowStyle Hidden

# 2. Shard 1 (Port 27200)
Write-Host "[2/3] Starting Shard 1 on port 27200 (shard1-rs)..." -ForegroundColor Yellow
Start-Process -FilePath $mongodPath -ArgumentList `
    "--shardsvr", `
    "--replSet shard1-rs", `
    "--port 27200", `
    "--dbpath `"$projectRoot\data\sharding\shard1`"", `
    "--logpath `"$projectRoot\data\logs\shard1.log`"", `
    "--wiredTigerCacheSizeGB 0.25", `
    "--bind_ip 127.0.0.1" -WindowStyle Hidden

# 3. Shard 2 (Port 27300)
Write-Host "[3/3] Starting Shard 2 on port 27300 (shard2-rs)..." -ForegroundColor Yellow
Start-Process -FilePath $mongodPath -ArgumentList `
    "--shardsvr", `
    "--replSet shard2-rs", `
    "--port 27300", `
    "--dbpath `"$projectRoot\data\sharding\shard2`"", `
    "--logpath `"$projectRoot\data\logs\shard2.log`"", `
    "--wiredTigerCacheSizeGB 0.25", `
    "--bind_ip 127.0.0.1" -WindowStyle Hidden

Start-Sleep -Seconds 3

Write-Host "`nChecking Node Ports..." -ForegroundColor Cyan
@(27100, 27200, 27300) | ForEach-Object {
    $c = Test-NetConnection -ComputerName 127.0.0.1 -Port $_ -WarningAction SilentlyContinue
    if ($c.TcpTestSucceeded) {
        Write-Host " [ONLINE] Node on port $_ is listening." -ForegroundColor Green
    } else {
        Write-Host " [WAITING] Node on port $_ is starting up..." -ForegroundColor Yellow
    }
}

Write-Host "`nNow run 'init_sharded_cluster.ps1' to initiate replica sets, start mongos, and add shards." -ForegroundColor Green
