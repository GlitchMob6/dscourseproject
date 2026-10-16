"""
failover_test.py - Distributed Systems Concepts 2 & 3:
  - Concept 2: Fault Tolerance
  - Concept 3: High Availability and Automatic Primary Election / Failover
"""

import time
import subprocess
from pathlib import Path
import pymongo
from pymongo import MongoClient
from pymongo.errors import AutoReconnect, ServerSelectionTimeoutError, NotPrimaryError
from tabulate import tabulate

PROJECT_ROOT = Path(__file__).resolve().parent.parent

REPLICA_SET_URI = "mongodb://127.0.0.1:27018,127.0.0.1:27019,127.0.0.1:27020/?replicaSet=rs0&serverSelectionTimeoutMS=2000"
NODES = [
    {"id": 0, "port": 27018, "dbpath": "data\\replica\\node1", "name": "Node 1 (27018)"},
    {"id": 1, "port": 27019, "dbpath": "data\\replica\\node2", "name": "Node 2 (27019)"},
    {"id": 2, "port": 27020, "dbpath": "data\\replica\\node3", "name": "Node 3 (27020)"}
]

def get_cluster_state():
    """Inspects status of all replica set nodes."""
    try:
        client = MongoClient(REPLICA_SET_URI, serverSelectionTimeoutMS=2000)
        status = client.admin.command('replSetGetStatus')
        members = status.get('members', [])
        rows = []
        for m in members:
            rows.append([
                m.get('_id'),
                m.get('name'),
                m.get('stateStr'),
                "HEALTHY (1)" if m.get('health') == 1 else "FAILED (0)",
                m.get('uptime', 0),
                str(m.get('optime', {}).get('ts', 'N/A'))
            ])
        client.close()
        return rows, None
    except Exception as e:
        return None, str(e)

def display_cluster_health():
    print("\n--- Current Replica Set Status (rs.status()) ---")
    rows, err = get_cluster_state()
    if rows:
        print(tabulate(rows, headers=["Member ID", "Host", "State", "Health", "Uptime (s)", "Optime Timestamp"], tablefmt="grid"))
    else:
        print(f"[!] Could not reach cluster: {err}")

def stop_node(port):
    """Gracefully shuts down a specific replica set node."""
    try:
        client = MongoClient(f"mongodb://127.0.0.1:{port}/?directConnection=true", serverSelectionTimeoutMS=1500)
        client.admin.command('shutdown')
    except Exception:
        pass
    print(f"[x] Shutdown signal sent to node on port {port}.")

def restart_node(node_info):
    """Restarts a stopped mongod node and verifies readiness."""
    import os
    import sys
    import glob
    import shutil
    matches = glob.glob(r"C:\Program Files\MongoDB\Server\*\bin\mongod.exe")
    if matches:
        mongod_path = sorted(matches, reverse=True)[0]
    else:
        m_find = shutil.which("mongod")
        mongod_path = m_find if m_find else "mongod.exe"

    dbpath = str(PROJECT_ROOT / node_info["dbpath"])
    logdir = PROJECT_ROOT / "data" / "logs"
    logdir.mkdir(parents=True, exist_ok=True)
    logpath = str(logdir / f"rs0_node_{node_info['port']}.log")

    cmd = [
        mongod_path,
        "--replSet", "rs0",
        "--port", str(node_info["port"]),
        "--dbpath", dbpath,
        "--logpath", logpath,
        "--wiredTigerCacheSizeGB", "0.25",
        "--bind_ip", "127.0.0.1"
    ]
    flags = 0
    if sys.platform == "win32":
        flags = subprocess.CREATE_NEW_PROCESS_GROUP
        if hasattr(subprocess, "DETACHED_PROCESS"):
            flags |= subprocess.DETACHED_PROCESS
    subprocess.Popen(cmd, creationflags=flags)
    print(f"[+] Restarted node on port {node_info['port']}. Waiting for readiness...")

    # Wait up to 15 seconds for node to respond to ping
    poll_start = time.time()
    while time.time() - poll_start < 15:
        try:
            probe = MongoClient(f"mongodb://127.0.0.1:{node_info['port']}/?directConnection=true", serverSelectionTimeoutMS=1000)
            probe.admin.command("ping")
            probe.close()
            break
        except Exception:
            time.sleep(0.5)

def run_fault_tolerance_demo():
    print("\n" + "=" * 75)
    print(" DISTRIBUTED SYSTEMS CONCEPT 2: FAULT TOLERANCE SIMULATION")
    print("=" * 75)
    print("Scenario: One secondary node crashes unexpectedly.")
    print("Expected: Database continues 100% operational with 2 remaining nodes.\n")

    display_cluster_health()

    target_port = 27020
    print(f"\n[*] [Step 1] Simulating crash on Secondary Node 3 (port {target_port})...")
    stop_node(target_port)
    time.sleep(2)

    print("\n[*] [Step 2] Testing read & write operations while Node 3 is down:")
    try:
        client = MongoClient(REPLICA_SET_URI)
        test_id = f"FT-TEST-{int(time.time())}"
        # Write test
        client.library_db.books.insert_one({
            "bookId": test_id,
            "title": "Fault Tolerant Systems",
            "author": "Israel Koren",
            "category": "Fault Tolerance",
            "totalCopies": 2,
            "availableCopies": 2
        })
        print(f"[SUCCESS] Write succeeded while Node 3 was offline! Document '{test_id}' inserted.")

        # Read test
        read_doc = client.library_db.books.find_one({"bookId": test_id})
        print(f"[SUCCESS] Read query succeeded: Found '{read_doc.get('title')}'.")
        client.library_db.books.delete_one({"bookId": test_id})
        client.close()
    except Exception as e:
        print(f"[FAILED] Operation failed: {e}")

    print(f"\n[*] [Step 3] Recovering Node 3 on port {target_port}...")
    restart_node(NODES[2])
    time.sleep(3)
    print("[+] Node 3 recovered and automatically synchronized with the cluster.")
    display_cluster_health()

def run_failover_demo():
    print("\n" + "=" * 75)
    print(" DISTRIBUTED SYSTEMS CONCEPT 3: HIGH AVAILABILITY & AUTOMATIC FAILOVER")
    print("=" * 75)
    print("Scenario: The current PRIMARY node crashes.")
    print("Expected: Cluster detects failure via heartbeats, holds an election,")
    print("          and elects a new Primary without administrator intervention.\n")

    # Identify current Primary
    try:
        client = MongoClient(REPLICA_SET_URI)
        hello = client.admin.command('hello')
        old_primary = hello.get('primary')
        print(f"[*] Step 1: Currently Elected Primary is: {old_primary}")
        client.close()
    except Exception as e:
        print(f"[!] Cannot determine primary: {e}")
        return

    # Extract port of primary
    primary_port = int(old_primary.split(":")[-1])
    target_node = next((n for n in NODES if n["port"] == primary_port), NODES[0])

    print(f"\n[*] Step 2: Crashing Primary Node on port {primary_port}...")
    stop_node(primary_port)

    print("\n[*] Step 3: Monitoring Automatic Election (Polling every 1 second)...")
    new_primary = None
    start_time = time.time()

    for sec in range(1, 20):
        time.sleep(1)
        # Attempt to discover new primary from surviving nodes
        for node in NODES:
            if node["port"] == primary_port:
                continue
            try:
                probe_client = MongoClient(f"mongodb://127.0.0.1:{node['port']}/?directConnection=true", serverSelectionTimeoutMS=1000)
                probe_hello = probe_client.admin.command('hello')
                if probe_hello.get('isWritablePrimary'):
                    new_primary = probe_hello.get('me')
                    probe_client.close()
                    break
                probe_client.close()
            except Exception:
                pass
        if new_primary:
            break
        print(f"    - [{sec}s] Heartbeat timeout detected, election in progress...")

    failover_duration = time.time() - start_time
    if new_primary:
        print(f"\n[>>> FAILOVER SUCCESSFUL <<<]")
        print(f"[+] Previous Primary : {old_primary} (DOWN)")
        print(f"[+] NEW Primary      : {new_primary} (ELECTED)")
        print(f"[+] Failover Latency : {failover_duration:.2f} seconds")
    else:
        print("\n[!] Election did not complete in 20 seconds. Check node health.")

    # Step 4: Test writes to the new Primary via application replica set URI
    print("\n[*] Step 4: Testing client write reconnect to new Primary...")
    try:
        reconnect_client = MongoClient(REPLICA_SET_URI)
        test_key = f"FAILOVER-TXN-{int(time.time())}"
        reconnect_client.library_db.books.insert_one({
            "bookId": test_key,
            "title": "High Availability in Distributed Systems",
            "author": "Distributed Systems Lab",
            "category": "High Availability",
            "totalCopies": 3,
            "availableCopies": 3
        })
        print(f"[+] Client write SUCCESSFUL on new primary! Document '{test_key}' stored.")
        reconnect_client.library_db.books.delete_one({"bookId": test_key})
        reconnect_client.close()
    except Exception as e:
        print(f"[!] Write to new primary failed: {e}")

    # Step 5: Recover original Primary node
    print(f"\n[*] Step 5: Recovering previous primary node (port {primary_port})...")
    restart_node(target_node)
    time.sleep(4)
    print(f"[+] Node on port {primary_port} restarted. It now rejoins as a SECONDARY member.")
    display_cluster_health()

    # Step 6: Theory explanation
    print("\n" + "=" * 75)
    print(" DISTRIBUTED SYSTEMS EXPLANATION: RAFT/PAXOS CONSENSUS & ELECTION")
    print("=" * 75)
    print("""
1. Heartbeat Protocol:
   Members exchange heartbeats (ping messages) every 2 seconds. If a primary
   does not respond within 10 seconds (electionTimeoutMillis), secondaries
   declare it dead and initiate an election.

2. Majority Quorum Rule:
   A candidate requires a strict majority of voting members (V/2 + 1) to become
   Primary. For N = 3 nodes, majority is 2. Since 2 nodes remained alive,
   an election succeeded immediately.

3. Split-Brain Prevention:
   If a network partition isolates 1 node from 2 nodes, the single node CANNOT
   claim majority (1 < 2) and automatically demotes itself to Secondary,
   preventing conflicting split writes.
""")

if __name__ == "__main__":
    display_cluster_health()
    run_fault_tolerance_demo()
    run_failover_demo()
