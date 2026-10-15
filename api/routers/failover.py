"""
Failover experiment router — wraps failover_test.py logic.
Exposes cluster health and controlled failover/fault-tolerance experiments.
"""

import time
import threading
from datetime import datetime
from fastapi import APIRouter
from pydantic import BaseModel
from pymongo import MongoClient
from api.job_store import JobStore

router = APIRouter()

REPLICA_SET_URI = "mongodb://127.0.0.1:27018,127.0.0.1:27019,127.0.0.1:27020/?replicaSet=rs0&serverSelectionTimeoutMS=2000"
NODES = [
    {"id": 0, "port": 27018, "dbpath": "data\\replica\\node1", "name": "Node 1 (27018)"},
    {"id": 1, "port": 27019, "dbpath": "data\\replica\\node2", "name": "Node 2 (27019)"},
    {"id": 2, "port": 27020, "dbpath": "data\\replica\\node3", "name": "Node 3 (27020)"},
]


@router.get("/status")
def cluster_health():
    """Get cluster health — same data as failover_test.display_cluster_health()."""
    try:
        client = MongoClient(REPLICA_SET_URI, serverSelectionTimeoutMS=2000)
        status = client.admin.command("replSetGetStatus")
        members = []
        for m in status.get("members", []):
            members.append({
                "id": m.get("_id"),
                "name": m.get("name"),
                "state": m.get("stateStr"),
                "health": "HEALTHY" if m.get("health") == 1 else "DOWN",
                "uptime": m.get("uptime", 0),
                "optime": str(m.get("optime", {}).get("ts", "N/A")),
                "electionDate": str(m.get("electionDate", "")),
            })
        hello = client.admin.command("hello")
        client.close()
        return {
            "connected": True,
            "primary": hello.get("primary", "N/A"),
            "setName": hello.get("setName", "rs0"),
            "members": members,
        }
    except Exception as e:
        return {"connected": False, "error": str(e), "members": []}


class FaultToleranceRequest(BaseModel):
    targetPort: int = 27020  # Default: crash secondary node 3


@router.post("/fault-tolerance")
def run_fault_tolerance(body: FaultToleranceRequest):
    """Simulate secondary node crash and verify operations continue."""
    valid_ports = [n["port"] for n in NODES]
    if body.targetPort not in valid_ports:
        return {"success": False, "message": f"Invalid port. Choose from {valid_ports}"}

    job_store = JobStore.get_instance()
    job_id = job_store.create_job("fault_tolerance")
    job_store.update_job(job_id, "running")

    def _run():
        try:
            result = _execute_fault_tolerance(body.targetPort)
            job_store.update_job(job_id, "completed", result=result)
        except Exception as e:
            job_store.update_job(job_id, "failed", error=str(e))

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    return {"job_id": job_id, "status": "running"}


@router.post("/failover")
def run_failover():
    """Simulate primary crash and automatic election."""
    job_store = JobStore.get_instance()
    job_id = job_store.create_job("failover")
    job_store.update_job(job_id, "running")

    def _run():
        try:
            result = _execute_failover()
            job_store.update_job(job_id, "completed", result=result)
        except Exception as e:
            job_store.update_job(job_id, "failed", error=str(e))

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    return {"job_id": job_id, "status": "running"}


def _stop_node(port):
    """Send shutdown command to a mongod node."""
    try:
        client = MongoClient(f"mongodb://127.0.0.1:{port}/?directConnection=true", serverSelectionTimeoutMS=1500)
        client.admin.command("shutdown")
    except Exception:
        pass


def _restart_node(node_info):
    """Restart a stopped mongod node."""
    import subprocess
    import sys
    import glob
    import shutil
    import os

    matches = glob.glob(r"C:\Program Files\MongoDB\Server\*\bin\mongod.exe")
    if matches:
        mongod_path = sorted(matches, reverse=True)[0]
    else:
        m_find = shutil.which("mongod")
        mongod_path = m_find if m_find else "mongod.exe"

    cmd = [
        mongod_path,
        "--replSet", "rs0",
        "--port", str(node_info["port"]),
        "--dbpath", node_info["dbpath"],
        "--logpath", f"data\\logs\\rs0_node_{node_info['port']}.log",
        "--wiredTigerCacheSizeGB", "0.25",
        "--bind_ip", "127.0.0.1",
    ]
    flags = 0
    if sys.platform == "win32":
        flags = subprocess.CREATE_NEW_PROCESS_GROUP
        if hasattr(subprocess, "DETACHED_PROCESS"):
            flags |= subprocess.DETACHED_PROCESS
    subprocess.Popen(cmd, creationflags=flags)
    time.sleep(3)


def _execute_fault_tolerance(target_port: int):
    steps = []

    # Pre-state
    try:
        client = MongoClient(REPLICA_SET_URI)
        hello = client.admin.command("hello")
        steps.append({
            "step": 1, "title": "Pre-Crash State",
            "status": "success", "primary": hello.get("primary"),
        })
        client.close()
    except Exception as e:
        return {"steps": [{"step": 1, "title": "Pre-Crash State", "status": "failed", "error": str(e)}]}

    # Crash target
    _stop_node(target_port)
    time.sleep(2)
    steps.append({"step": 2, "title": f"Crashed Node on Port {target_port}", "status": "success"})

    # Test operations
    try:
        client = MongoClient(REPLICA_SET_URI)
        test_id = f"FT-TEST-{int(time.time())}"
        client.library_db.books.insert_one({
            "bookId": test_id, "title": "Fault Tolerant Systems", "author": "Test",
            "category": "FT", "totalCopies": 2, "availableCopies": 2,
        })
        read_doc = client.library_db.books.find_one({"bookId": test_id})
        client.library_db.books.delete_one({"bookId": test_id})
        client.close()
        steps.append({
            "step": 3, "title": "Operations While Node Down",
            "status": "success",
            "writeSucceeded": True,
            "readSucceeded": read_doc is not None,
        })
    except Exception as e:
        steps.append({"step": 3, "title": "Operations While Node Down", "status": "failed", "error": str(e)})

    # Recover
    target_node = next((n for n in NODES if n["port"] == target_port), NODES[2])
    _restart_node(target_node)
    time.sleep(3)
    steps.append({"step": 4, "title": f"Recovered Node on Port {target_port}", "status": "success"})

    # Post state
    try:
        client = MongoClient(REPLICA_SET_URI)
        status = client.admin.command("replSetGetStatus")
        post_members = []
        for m in status.get("members", []):
            post_members.append({
                "name": m.get("name"), "state": m.get("stateStr"),
                "health": "HEALTHY" if m.get("health") == 1 else "DOWN",
            })
        client.close()
        steps.append({"step": 5, "title": "Post-Recovery State", "status": "success", "members": post_members})
    except Exception as e:
        steps.append({"step": 5, "title": "Post-Recovery State", "status": "failed", "error": str(e)})

    return {"steps": steps, "completedAt": datetime.now().isoformat()}


def _execute_failover():
    steps = []

    # Identify current primary
    try:
        client = MongoClient(REPLICA_SET_URI)
        hello = client.admin.command("hello")
        old_primary = hello.get("primary")
        client.close()
        steps.append({"step": 1, "title": "Identify Current Primary", "status": "success", "oldPrimary": old_primary})
    except Exception as e:
        return {"steps": [{"step": 1, "title": "Identify Current Primary", "status": "failed", "error": str(e)}]}

    primary_port = int(old_primary.split(":")[-1])

    # Crash primary
    _stop_node(primary_port)
    steps.append({"step": 2, "title": f"Crashed Primary on Port {primary_port}", "status": "success"})

    # Monitor election
    new_primary = None
    start_time = time.time()
    election_log = []

    for sec in range(1, 21):
        time.sleep(1)
        for node in NODES:
            if node["port"] == primary_port:
                continue
            try:
                probe = MongoClient(
                    f"mongodb://127.0.0.1:{node['port']}/?directConnection=true",
                    serverSelectionTimeoutMS=1000,
                )
                probe_hello = probe.admin.command("hello")
                if probe_hello.get("isWritablePrimary"):
                    new_primary = probe_hello.get("me")
                    probe.close()
                    break
                probe.close()
            except Exception:
                pass
        if new_primary:
            break
        election_log.append(f"{sec}s - Election in progress...")

    failover_duration = round(time.time() - start_time, 2)
    steps.append({
        "step": 3, "title": "Election Monitoring",
        "status": "success" if new_primary else "timeout",
        "newPrimary": new_primary,
        "failoverDurationSec": failover_duration,
        "electionLog": election_log,
    })

    # Test write to new primary
    if new_primary:
        try:
            rc = MongoClient(REPLICA_SET_URI)
            test_key = f"FAILOVER-TXN-{int(time.time())}"
            rc.library_db.books.insert_one({
                "bookId": test_key, "title": "HA Test", "author": "Test",
                "category": "HA", "totalCopies": 3, "availableCopies": 3,
            })
            rc.library_db.books.delete_one({"bookId": test_key})
            rc.close()
            steps.append({"step": 4, "title": "Write to New Primary", "status": "success"})
        except Exception as e:
            steps.append({"step": 4, "title": "Write to New Primary", "status": "failed", "error": str(e)})

    # Recover old primary
    target_node = next((n for n in NODES if n["port"] == primary_port), NODES[0])
    _restart_node(target_node)
    time.sleep(4)
    steps.append({"step": 5, "title": f"Recovered Old Primary (Port {primary_port})", "status": "success"})

    # Post state
    try:
        client = MongoClient(REPLICA_SET_URI)
        status = client.admin.command("replSetGetStatus")
        post_members = []
        for m in status.get("members", []):
            post_members.append({
                "name": m.get("name"), "state": m.get("stateStr"),
                "health": "HEALTHY" if m.get("health") == 1 else "DOWN",
            })
        client.close()
        steps.append({"step": 6, "title": "Final Cluster State", "status": "success", "members": post_members})
    except Exception as e:
        steps.append({"step": 6, "title": "Final Cluster State", "status": "failed", "error": str(e)})

    return {
        "steps": steps,
        "oldPrimary": old_primary,
        "newPrimary": new_primary,
        "failoverDurationSec": failover_duration,
        "completedAt": datetime.now().isoformat(),
    }
