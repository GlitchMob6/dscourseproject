"""
Performance benchmarking router — wraps performance_test.py and generate_dataset.py.
"""

import time
import threading
from datetime import datetime
from fastapi import APIRouter, Query
from pydantic import BaseModel
from typing import Optional
from pymongo import MongoClient
from api.job_store import JobStore

router = APIRouter()

STANDALONE_URI = "mongodb://127.0.0.1:27017/?serverSelectionTimeoutMS=2000"
REPLICA_SET_URI = "mongodb://127.0.0.1:27018,127.0.0.1:27019,127.0.0.1:27020/?replicaSet=rs0&serverSelectionTimeoutMS=2000"
SHARDED_URI = "mongodb://127.0.0.1:27050/?serverSelectionTimeoutMS=2000"


class BenchmarkRequest(BaseModel):
    datasetSize: int = 500
    environments: Optional[list] = None  # ["standalone", "replica_set", "sharded"]


@router.post("/run")
def run_benchmark(body: BenchmarkRequest):
    """Run performance benchmark in background."""
    # Clamp dataset size
    dataset_size = max(100, min(body.datasetSize, 5000))
    envs = body.environments or ["standalone", "replica_set", "sharded"]

    job_store = JobStore.get_instance()
    job_id = job_store.create_job("benchmark")
    job_store.update_job(job_id, "running")

    def _run():
        try:
            result = _execute_benchmark(dataset_size, envs)
            job_store.update_job(job_id, "completed", result=result)
        except Exception as e:
            job_store.update_job(job_id, "failed", error=str(e))

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()
    return {"job_id": job_id, "status": "running", "datasetSize": dataset_size, "environments": envs}


@router.get("/job/{job_id}")
def get_job_status(job_id: str):
    """Check status of a benchmark job."""
    job_store = JobStore.get_instance()
    job = job_store.get_job(job_id)
    if not job:
        return {"error": f"Job '{job_id}' not found."}
    return job


@router.get("/jobs")
def list_jobs(job_type: Optional[str] = Query(None)):
    """List recent experiment jobs."""
    job_store = JobStore.get_instance()
    return {"jobs": job_store.list_jobs(job_type=job_type)}


class GenerateDataRequest(BaseModel):
    count: int = 500
    clearExisting: bool = False


@router.post("/generate-data")
def populate_dataset(body: GenerateDataRequest):
    """Generate synthetic books and insert into current active database."""
    from app.database import DatabaseManager
    count = max(10, min(body.count, 5000))
    books = _generate_books(count)

    try:
        db_mgr = DatabaseManager.get_instance()
        db = db_mgr.get_db()
        if body.clearExisting:
            db.books.delete_many({})
        # Insert with ordered=False to skip duplicates
        inserted = 0
        try:
            res = db.books.insert_many(books, ordered=False)
            inserted = len(res.inserted_ids)
        except Exception as e:
            # Check how many inserted before duplicate error
            if hasattr(e, "details") and "nInserted" in e.details:
                inserted = e.details["nInserted"]
            else:
                inserted = db.books.count_documents({})
        return {
            "success": True,
            "message": f"Generated and inserted {inserted} books into active database ({db_mgr.current_mode}).",
            "count": inserted,
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


def _generate_books(count):
    """Inline dataset generation — reuses the same logic as generate_dataset.py."""
    import random
    rng = random.Random(42)

    categories = [
        "Computer Science", "Electrical Engineering", "Mechanical Engineering",
        "Civil Engineering", "Information Technology", "Mathematics", "Physics",
        "Management Studies",
    ]
    authors = [
        "Andrew S. Tanenbaum", "Martin Kleppmann", "Abraham Silberschatz",
        "Donald E. Knuth", "Thomas H. Cormen", "Stuart Russell", "Peter Norvig",
        "Ian Goodfellow", "David Patterson", "John L. Hennessy",
    ]
    topics = [
        "Distributed Systems", "Data-Intensive Applications", "Operating Systems",
        "Algorithms", "AI: Modern Approach", "Deep Learning", "Computer Architecture",
        "Multiprocessor Programming", "Clean Code", "Domain-Driven Design",
    ]

    books = []
    for i in range(1, count + 1):
        cat = categories[i % len(categories)]
        author = rng.choice(authors)
        topic = rng.choice(topics)
        edition = rng.choice(["1st", "2nd", "3rd", "Global", "Revised"])
        copies = rng.randint(2, 8)
        books.append({
            "bookId": f"BK-{i:05d}",
            "title": f"{topic} ({edition} Ed.) Vol. {((i - 1) % 5) + 1}",
            "author": author,
            "category": cat,
            "totalCopies": copies,
            "availableCopies": copies,
        })
    return books


def _benchmark_one(name, uri, books_data):
    """Benchmark a single architecture."""
    try:
        client = MongoClient(uri)
        client.admin.command("ping")
    except Exception as e:
        return {
            "architecture": name,
            "status": "OFFLINE",
            "error": str(e),
        }

    try:
        db = client["benchmark_db"]
        coll = db["perf_books"]
        coll.drop()
        coll.create_index([("bookId", 1)], unique=True)
        coll.create_index([("category", 1)])

        # Bulk insert (use fresh dict copies to prevent in-place _id mutation across environments)
        t0 = time.perf_counter()
        fresh_books = [dict(b) for b in books_data]
        coll.insert_many(fresh_books, ordered=False)
        insert_sec = time.perf_counter() - t0
        throughput = len(books_data) / insert_sec
        avg_insert_ms = (insert_sec / len(books_data)) * 1000

        # Point queries
        point_lats = []
        for bid in [f"BK-{i:05d}" for i in range(100, 200)]:
            t1 = time.perf_counter()
            coll.find_one({"bookId": bid})
            point_lats.append((time.perf_counter() - t1) * 1000)

        # Range queries
        range_lats = []
        for cat in ["Computer Science", "Physics", "Mathematics"]:
            t2 = time.perf_counter()
            list(coll.find({"category": cat}))
            range_lats.append((time.perf_counter() - t2) * 1000)

        coll.drop()
        client.close()

        return {
            "architecture": name,
            "status": "COMPLETED",
            "datasetSize": len(books_data),
            "insertTimeSec": round(insert_sec, 3),
            "throughputDocsPerSec": round(throughput, 1),
            "avgInsertLatencyMs": round(avg_insert_ms, 3),
            "pointQueryLatencyMs": round(sum(point_lats) / len(point_lats), 3),
            "rangeQueryLatencyMs": round(sum(range_lats) / len(range_lats), 3),
            "pointQueryLatencies": [round(l, 2) for l in point_lats],
            "rangeQueryLatencies": [round(l, 2) for l in range_lats],
        }
    except Exception as e:
        return {"architecture": name, "status": "FAILED", "error": str(e)}


def _execute_benchmark(dataset_size, envs):
    books = _generate_books(dataset_size)

    env_map = {
        "standalone": ("Standalone (27017)", STANDALONE_URI),
        "replica_set": ("Replica Set (rs0)", REPLICA_SET_URI),
        "sharded": ("Sharded Cluster (mongos)", SHARDED_URI),
    }

    results = []
    for env_key in envs:
        if env_key in env_map:
            name, uri = env_map[env_key]
            results.append(_benchmark_one(name, uri, books))

    return {
        "datasetSize": dataset_size,
        "environments": envs,
        "results": results,
        "completedAt": datetime.now().isoformat(),
    }
