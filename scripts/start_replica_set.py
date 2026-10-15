"""
start_replica_set.py - Starts 3-Node MongoDB Replica Set rs0
Ports:
  Node 1: 27018 (Priority 2, Primary)
  Node 2: 27019 (Priority 1, Secondary)
  Node 3: 27020 (Priority 1, Secondary)
"""

import sys
import os
import time
import subprocess
from pymongo import MongoClient

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

import glob
import shutil

NODES = [
    {"port": 27018, "dir": os.path.join(PROJECT_ROOT, "data", "replica", "node1"), "log": "rs0_node1.log"},
    {"port": 27019, "dir": os.path.join(PROJECT_ROOT, "data", "replica", "node2"), "log": "rs0_node2.log"},
    {"port": 27020, "dir": os.path.join(PROJECT_ROOT, "data", "replica", "node3"), "log": "rs0_node3.log"},
]

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

def start_nodes():
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
    print(" Starting Stage A: MongoDB 3-Node Replica Set (rs0)")
    print(f" MongoDB Binary: {mongod_bin}")
    print("=" * 65)

    log_dir = os.path.join(PROJECT_ROOT, "data", "logs")
    os.makedirs(log_dir, exist_ok=True)

    flags = 0
    if sys.platform == "win32":
        flags = subprocess.CREATE_NEW_PROCESS_GROUP
        if hasattr(subprocess, "DETACHED_PROCESS"):
            flags |= subprocess.DETACHED_PROCESS

    for idx, node in enumerate(NODES, start=1):
        port = node["port"]
        if is_node_online(port):
            print(f" [*] [{idx}/3] Node on port {port} is ALREADY ONLINE.")
            continue

        os.makedirs(node["dir"], exist_ok=True)
        log_path = os.path.join(log_dir, node["log"])

        cmd = [
            mongod_bin,
            "--replSet", "rs0",
            "--port", str(port),
            "--dbpath", node["dir"],
            "--logpath", log_path,
            "--wiredTigerCacheSizeGB", "0.25",
            "--bind_ip", "127.0.0.1"
        ]

        print(f" [+] [{idx}/3] Starting Replica Set Node on port {port}...")
        subprocess.Popen(cmd, creationflags=flags)

    print("\n[*] Verifying node readiness...")
    for _ in range(10):
        time.sleep(1)
        statuses = [is_node_online(n["port"]) for n in NODES]
        if all(statuses):
            break

    for n in NODES:
        p = n["port"]
        status = "ONLINE" if is_node_online(p) else "OFFLINE"
        print(f" - Port {p}: [{status}]")

    print("\n[+] Replica Set nodes are running!")
    print("Next step: Run 'scripts/init_replica_set.py' to initiate replica set consensus.")

if __name__ == "__main__":
    start_nodes()
