# ==============================================================================
# Script: start_replica_set.ps1
# Purpose: Start 3 MongoDB instances for Replica Set 'rs0' on separate ports
# Ports: Node 1 (27018), Node 2 (27019), Node 3 (27020)
# ==============================================================================

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

# Locate mongod.exe
$foundMongod = Get-ChildItem -Path "C:\Program Files\MongoDB\Server" -Filter "mongod.exe" -Recurse -Depth 2 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName -First 1
if ($foundMongod) {
    $mongodPath = $foundMongod
} else {
    $mongodCmd = Get-Command mongod -ErrorAction SilentlyContinue
    if ($mongodCmd) {
        $mongodPath = $mongodCmd.Source
    } else {
        Write-Error "mongod.exe was not found. Please install MongoDB Community Server."
        exit 1
    }
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Starting Stage A: MongoDB 3-Node Replica Set (rs0)" -ForegroundColor Cyan
Write-Host " MongoDB Binary: $mongodPath" -ForegroundColor DarkGray
Write-Host "==========================================================" -ForegroundColor Cyan

# Create data and log directories
$dirs = @(
    "$projectRoot\data\replica\node1",
    "$projectRoot\data\replica\node2",
    "$projectRoot\data\replica\node3",
    "$projectRoot\data\logs"
)
foreach ($d in $dirs) {
    if (-not (Test-Path $d)) {
        New-Item -ItemType Directory -Path $d -Force | Out-Null
    }
}

# Node 1 (Port 27018)
Write-Host "[1/3] Starting Replica Set Node 1 on port 27018..." -ForegroundColor Yellow
Start-Process -FilePath $mongodPath -ArgumentList `
    "--replSet rs0", `
    "--port 27018", `
    "--dbpath `"$projectRoot\data\replica\node1`"", `
    "--logpath `"$projectRoot\data\logs\rs0_node1.log`"", `
    "--wiredTigerCacheSizeGB 0.25", `
    "--bind_ip 127.0.0.1" -WindowStyle Hidden

# Node 2 (Port 27019)
Write-Host "[2/3] Starting Replica Set Node 2 on port 27019..." -ForegroundColor Yellow
Start-Process -FilePath $mongodPath -ArgumentList `
    "--replSet rs0", `
    "--port 27019", `
    "--dbpath `"$projectRoot\data\replica\node2`"", `
    "--logpath `"$projectRoot\data\logs\rs0_node2.log`"", `
    "--wiredTigerCacheSizeGB 0.25", `
    "--bind_ip 127.0.0.1" -WindowStyle Hidden

# Node 3 (Port 27020)
Write-Host "[3/3] Starting Replica Set Node 3 on port 27020..." -ForegroundColor Yellow
Start-Process -FilePath $mongodPath -ArgumentList `
    "--replSet rs0", `
    "--port 27020", `
    "--dbpath `"$projectRoot\data\replica\node3`"", `
    "--logpath `"$projectRoot\data\logs\rs0_node3.log`"", `
    "--wiredTigerCacheSizeGB 0.25", `
    "--bind_ip 127.0.0.1" -WindowStyle Hidden

Start-Sleep -Seconds 3

Write-Host "`nVerifying listening ports..." -ForegroundColor Cyan
$ports = @(27018, 27019, 27020)
foreach ($port in $ports) {
    $conn = Test-NetConnection -ComputerName 127.0.0.1 -Port $port -WarningAction SilentlyContinue
    if ($conn.TcpTestSucceeded) {
        Write-Host " [ONLINE] Node on port $port is listening." -ForegroundColor Green
    } else {
        Write-Host " [WAITING] Node on port $port is initializing..." -ForegroundColor DarkYellow
    }
}

Write-Host "`nReplica set nodes started!" -ForegroundColor Green
Write-Host "Next step: Run 'init_replica_set.ps1' or option 10 in main.py to initiate the replica set." -ForegroundColor White
