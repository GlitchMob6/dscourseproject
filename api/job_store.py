"""
api/job_store.py - Simple in-memory job store for background experiment tracking.
Each job has: id, type, status (pending/running/completed/failed), result, timestamps.
"""

import uuid
import threading
from datetime import datetime
from typing import Any, Dict, Optional


class JobStore:
    _instance = None
    _lock = threading.Lock()

    def __init__(self):
        self.jobs: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = JobStore()
        return cls._instance

    def create_job(self, job_type: str) -> str:
        job_id = f"JOB-{uuid.uuid4().hex[:8].upper()}"
        self.jobs[job_id] = {
            "id": job_id,
            "type": job_type,
            "status": "pending",
            "result": None,
            "error": None,
            "created_at": datetime.now().isoformat(),
            "completed_at": None,
        }
        return job_id

    def update_job(self, job_id: str, status: str, result: Any = None, error: Optional[str] = None):
        if job_id in self.jobs:
            self.jobs[job_id]["status"] = status
            self.jobs[job_id]["result"] = result
            self.jobs[job_id]["error"] = error
            if status in ("completed", "failed"):
                self.jobs[job_id]["completed_at"] = datetime.now().isoformat()

    def get_job(self, job_id: str) -> Optional[Dict]:
        return self.jobs.get(job_id)

    def list_jobs(self, job_type: Optional[str] = None, limit: int = 20) -> list:
        jobs = list(self.jobs.values())
        if job_type:
            jobs = [j for j in jobs if j["type"] == job_type]
        return sorted(jobs, key=lambda j: j["created_at"], reverse=True)[:limit]
