"""
Replication experiment router — wraps replication_test.py logic for the UI.
Returns structured JSON instead of printing to stdout.
"""

import time
import uuid
import threading
from datetime import datetime
from fastapi import APIRouter
from pymongo import MongoClient
from api.job_store import JobStore

router = APIRouter()

REPLICA_SET_URI = "mongodb://127.0.0.1:27018,127.0.0.1:27019,127.0.0.1:27020/?replicaSet=rs0&serverSelectionTimeoutMS=3000"
NODES = [
    {"name": "Node 1", "host": "127.0.0.1", "port": 27018},
    {"name": "Node 2", "host": "127.0.0.1", "port": 27019},
    {"name": "Node 3", "host": "127.0.0.1", "port": 27020},
]


@router.get("/status")
def replica_set_status():
    """Get replica set member status via replSetGetStatus."""
    try:
        client = MongoClient(REPLICA_SET_URI, serverSelectionTimeoutMS=3000)
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
                "syncSourceHost": m.get("syncSourceHost", ""),
            })
        hello = client.admin.command("hello")
        client.close()
        return {
            "connected": True,
            "setName": hello.get("setName", "rs0"),
            "primary": hello.get("primary", "N/A"),
            "members": members,
        }
    except Exception as e:
        return {"connected": False, "error": str(e), "members": []}


@router.post("/experiment")
def run_replication_experiment():
    """Run the full replication experiment and return structured results."""
    job_store = JobStore.get_instance()
    job_id = job_store.create_job("replication")
    job_store.update_job(job_id, "running")

    def _run():
        try:
            result = _execute_replication_experiment()
            job_store.update_job(job_id, "completed", result=result)
        except Exception as e:
            job_store.update_job(job_id, "failed", error=str(e))

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    return {"job_id": job_id, "status": "running"}


def _execute_replication_experiment():
    steps = []

    # Step 1: Connect
    try:
        rs_client = MongoClient(REPLICA_SET_URI)
        hello = rs_client.admin.command("hello")
        primary_host = hello.get("primary")
        steps.append({
            "step": 1,
            "title": "Connect to Replica Set",
            "status": "success",
            "primary": primary_host,
            "setName": hello.get("setName", "rs0"),
            "hosts": hello.get("hosts", []),
        })
    except Exception as e:
        return {"steps": [{"step": 1, "title": "Connect to Replica Set", "status": "failed", "error": str(e)}]}

    # Step 2: Insert test document on primary
    test_id = f"REP-TEST-{uuid.uuid4().hex[:6].upper()}"
    test_doc = {
        "bookId": test_id,
        "title": "Replication Test Document",
        "author": "Experiment Runner",
        "category": "Distributed Systems",
        "totalCopies": 5,
        "availableCopies": 5,
        "insertedAt": datetime.now().isoformat(),
    }
    t0 = time.perf_counter()
    rs_client.library_db.books.insert_one(test_doc)
    write_time_ms = (time.perf_counter() - t0) * 1000
    steps.append({
        "step": 2,
        "title": "Insert Test Document",
        "status": "success",
        "testId": test_id,
        "writeLatencyMs": round(write_time_ms, 2),
    })

    # Step 3: Check each node
    node_results = []
    for node in NODES:
        uri = f"mongodb://{node['host']}:{node['port']}/?directConnection=true&serverSelectionTimeoutMS=2000"
        try:
            dc = MongoClient(uri)
            nh = dc.admin.command("hello")
            role = "PRIMARY" if nh.get("isWritablePrimary") else ("SECONDARY" if nh.get("secondary") else "OTHER")
            t_check = time.perf_counter()
            found = dc.library_db.books.find_one({"bookId": test_id}, {"_id": 0})
            read_ms = (time.perf_counter() - t_check) * 1000
            node_results.append({
                "node": node["name"],
                "port": node["port"],
                "role": role,
                "syncStatus": "SYNCHRONIZED" if found else "NOT_FOUND",
                "readLatencyMs": round(read_ms, 2),
            })
            dc.close()
        except Exception as err:
            node_results.append({
                "node": node["name"],
                "port": node["port"],
                "role": "OFFLINE",
                "syncStatus": "UNREACHABLE",
                "error": str(err)[:100],
            })

    steps.append({"step": 3, "title": "Verify Replication on All Nodes", "status": "success", "nodes": node_results})

    # Step 4: Update and verify propagation
    rs_client.library_db.books.update_one({"bookId": test_id}, {"$set": {"availableCopies": 4}})
    time.sleep(0.15)
    update_checks = []
    for node in NODES:
        try:
            dc = MongoClient(f"mongodb://{node['host']}:{node['port']}/?directConnection=true&serverSelectionTimeoutMS=1500")
            doc = dc.library_db.books.find_one({"bookId": test_id}, {"_id": 0, "availableCopies": 1})
            update_checks.append({
                "node": node["name"],
                "port": node["port"],
                "availableCopies": doc.get("availableCopies") if doc else None,
                "replicated": doc.get("availableCopies") == 4 if doc else False,
            })
            dc.close()
        except Exception:
            update_checks.append({"node": node["name"], "port": node["port"], "availableCopies": None, "replicated": False})

    steps.append({"step": 4, "title": "Update Propagation Check", "status": "success", "updateResults": update_checks})

    # Step 5: Cleanup
    rs_client.library_db.books.delete_one({"bookId": test_id})
    rs_client.close()
    steps.append({"step": 5, "title": "Cleanup Test Data", "status": "success"})

    return {"steps": steps, "testId": test_id, "completedAt": datetime.now().isoformat()}
