"""
Consistency experiment router — wraps consistency_test.py for the UI.
"""

import time
import uuid
import threading
from datetime import datetime
from fastapi import APIRouter
from pymongo import MongoClient, ReadPreference, WriteConcern
from api.job_store import JobStore

router = APIRouter()

REPLICA_SET_URI = "mongodb://127.0.0.1:27018,127.0.0.1:27019,127.0.0.1:27020/?replicaSet=rs0&serverSelectionTimeoutMS=3000"


@router.post("/experiment")
def run_consistency_experiment():
    """Run the full consistency experiment in background."""
    job_store = JobStore.get_instance()
    job_id = job_store.create_job("consistency")
    job_store.update_job(job_id, "running")

    def _run():
        try:
            result = _execute_consistency_experiment()
            job_store.update_job(job_id, "completed", result=result)
        except Exception as e:
            job_store.update_job(job_id, "failed", error=str(e))

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    return {"job_id": job_id, "status": "running"}


def _execute_consistency_experiment():
    try:
        client = MongoClient(REPLICA_SET_URI)
        client.admin.command("ping")
    except Exception as e:
        return {"error": f"Replica Set connection failed: {e}"}

    iterations = 20

    # Part 1: Write concern comparison
    db_w1 = client.get_database("library_db", write_concern=WriteConcern(w=1, wtimeout=5000))
    latencies_w1 = []
    for i in range(iterations):
        doc = {"bookId": f"CONS-W1-{i}", "title": f"Consistency W1 #{i}", "copies": 1}
        t0 = time.perf_counter()
        db_w1.books.insert_one(doc)
        latencies_w1.append((time.perf_counter() - t0) * 1000)

    db_wmaj = client.get_database("library_db", write_concern=WriteConcern(w="majority", wtimeout=5000))
    latencies_wmaj = []
    for i in range(iterations):
        doc = {"bookId": f"CONS-WMAJ-{i}", "title": f"Consistency Majority #{i}", "copies": 1}
        t0 = time.perf_counter()
        db_wmaj.books.insert_one(doc)
        latencies_wmaj.append((time.perf_counter() - t0) * 1000)

    # Cleanup
    client.library_db.books.delete_many({"bookId": {"$regex": "^CONS-"}})

    write_results = {
        "w1": {
            "label": "w: 1 (Primary Only)",
            "min": round(min(latencies_w1), 2),
            "max": round(max(latencies_w1), 2),
            "avg": round(sum(latencies_w1) / len(latencies_w1), 2),
            "durability": "Low (Fast)",
            "latencies": [round(l, 2) for l in latencies_w1],
        },
        "wMajority": {
            "label": "w: majority (Quorum)",
            "min": round(min(latencies_wmaj), 2),
            "max": round(max(latencies_wmaj), 2),
            "avg": round(sum(latencies_wmaj) / len(latencies_wmaj), 2),
            "durability": "Strong (Safe)",
            "latencies": [round(l, 2) for l in latencies_wmaj],
        },
    }

    # Part 2: Read preferences
    probe_id = f"PROBE-{uuid.uuid4().hex[:6].upper()}"
    db_w1.books.insert_one({"bookId": probe_id, "title": "Realtime Update Probe", "version": 1})

    read_modes = [
        ("primary", ReadPreference.PRIMARY, "Strict / Linearizable"),
        ("secondary", ReadPreference.SECONDARY, "Eventual Consistency"),
        ("secondaryPreferred", ReadPreference.SECONDARY_PREFERRED, "Secondary preferred, fallback primary"),
        ("nearest", ReadPreference.NEAREST, "Lowest network latency"),
    ]

    read_results = []
    for mode_name, pref, description in read_modes:
        db_read = client.get_database("library_db", read_preference=pref)
        t_start = time.perf_counter()
        doc = db_read.books.find_one({"bookId": probe_id})
        t_read = (time.perf_counter() - t_start) * 1000
        read_results.append({
            "mode": mode_name,
            "description": description,
            "found": doc is not None,
            "latencyMs": round(t_read, 2),
        })

    client.library_db.books.delete_one({"bookId": probe_id})
    client.close()

    return {
        "writeConcern": write_results,
        "readPreference": read_results,
        "completedAt": datetime.now().isoformat(),
    }
