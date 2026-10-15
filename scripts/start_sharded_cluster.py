"""
start_sharded_cluster.py - Starts MongoDB Sharded Cluster Nodes (Stage B)
Nodes:
  Config Server : 27100 (cfg-rs)
  Shard 1       : 27200 (shard1-rs)
  Shard 2       : 27300 (shard2-rs)
"""

import sys
import os
import time
import subprocess
from pymongo import MongoClient

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SHARD_NODES = [
    {
        "name": "Config Server (cfg-rs)",
        "port": 27100,
        "dir": os.path.join(PROJECT_ROOT, "data", "sharding", "config1"),
        "log": "config1.log",
        "extra_args": ["--configsvr", "--replSet", "cfg-rs"]
    },
    {
        "name": "Shard 1 (shard1-rs)",
        "port": 27200,
        "dir": os.path.join(PROJECT_ROOT, "data", "sharding", "shard1"),
        "log": "shard1.log",
        "extra_args": ["--shardsvr", "--replSet", "shard1-rs"]
    },
    {
        "name": "Shard 2 (shard2-rs)",
        "port": 27300,
        "dir": os.path.join(PROJECT_ROOT, "data", "sharding", "shard2"),
        "log": "shard2.log",
        "extra_args": ["--shardsvr", "--replSet", "shard2-rs"]
    }
]

import glob
import shutil

def find_mongod():
    # Check all installed MongoDB Server versions (e.g. 8.2, 8.0, 7.0, etc.)
    matches = glob.glob(r"C:\Program Files\MongoDB\Server\*\bin\mongod.exe")
    if matches:
        return sorted(matches, reverse=True)[0]
    p = shutil.which("mongod")
    if p:
        return p
    return "mongod.exe"

def is_node_online(port):
    try:
        c = MongoClient(f"mongodb://127.0.0.1:{port}/?directConnection=true", serverSelectionTimeoutMS=800)
        c.admin.command("ping")
        c.close()
        return True
    except Exception:
        return False

def start_cluster_nodes():
    mongod_bin = find_mongod()
    if not os.path.exists(mongod_bin) and not shutil.which(mongod_bin):
        print("=" * 65)
        print(" [!] ERROR: MongoDB Server binary (mongod.exe) was not found!")
        print(" Please ensure MongoDB Community Server is installed.")
        print(" You can install it using:")
        print("   winget install --id MongoDB.Server --exact")
        print(" Or download from: https://www.mongodb.com/try/download/community")
        print("=" * 65)
        sys.exit(1)

    print("=" * 65)
    print(" Starting Stage B: MongoDB Sharded Cluster Data Nodes")
    print(f" MongoDB Binary: {mongod_bin}")
    print("=" * 65)

    log_dir = os.path.join(PROJECT_ROOT, "data", "logs")
    os.makedirs(log_dir, exist_ok=True)

    flags = 0
    if sys.platform == "win32":
        flags = subprocess.CREATE_NEW_PROCESS_GROUP
        if hasattr(subprocess, "DETACHED_PROCESS"):
            flags |= subprocess.DETACHED_PROCESS

    for idx, node in enumerate(SHARD_NODES, start=1):
        port = node["port"]
        if is_node_online(port):
            print(f" [*] [{idx}/3] {node['name']} on port {port} is ALREADY ONLINE.")
            continue

        os.makedirs(node["dir"], exist_ok=True)
        log_path = os.path.join(log_dir, node["log"])

        cmd = [
            mongod_bin,
            "--port", str(port),
            "--dbpath", node["dir"],
            "--logpath", log_path,
            "--wiredTigerCacheSizeGB", "0.25",
            "--bind_ip", "127.0.0.1"
        ] + node["extra_args"]

        print(f" [+] [{idx}/3] Starting {node['name']} on port {port}...")
        subprocess.Popen(cmd, creationflags=flags)

    print("\n[*] Verifying node readiness...")
    for _ in range(10):
        time.sleep(1)
        statuses = [is_node_online(n["port"]) for n in SHARD_NODES]
        if all(statuses):
            break

    for n in SHARD_NODES:
        p = n["port"]
        status = "ONLINE" if is_node_online(p) else "OFFLINE"
        print(f" - Port {p} ({n['name']}): [{status}]")

    print("\n[+] Sharded Cluster storage nodes started!")
    print("Next step: Run 'scripts/init_sharded_cluster.py' to launch mongos and configure sharding.")

if __name__ == "__main__":
    start_cluster_nodes()
