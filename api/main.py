"""
api/main.py - FastAPI Application Entry Point
Wraps existing DatabaseManager and LibraryService for HTTP access.
"""

import sys
import os
from contextlib import asynccontextmanager

# Ensure project root is in sys.path so existing imports work
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routers import health, books, members, replication, consistency, failover, sharding, queries, benchmarks


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    # Import here to trigger singleton creation with fallback logic
    from app.database import DatabaseManager
    try:
        DatabaseManager.get_instance()
    except Exception:
        pass  # Graceful — health endpoint will report status
    yield


app = FastAPI(
    title="Distributed Library Management System",
    description="API layer for the MongoDB-based distributed systems academic project",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow Vite dev server on any local port
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(health.router, prefix="/api/health", tags=["Health"])
app.include_router(books.router, prefix="/api/books", tags=["Books"])
app.include_router(members.router, prefix="/api/members", tags=["Members"])
app.include_router(replication.router, prefix="/api/replication", tags=["Replication"])
app.include_router(consistency.router, prefix="/api/consistency", tags=["Consistency"])
app.include_router(failover.router, prefix="/api/failover", tags=["Failover"])
app.include_router(sharding.router, prefix="/api/sharding", tags=["Sharding"])
app.include_router(queries.router, prefix="/api/queries", tags=["Queries"])
app.include_router(benchmarks.router, prefix="/api/benchmarks", tags=["Benchmarks"])

# Global Jobs endpoints (universal background task tracking)
from api.job_store import JobStore
from typing import Optional

@app.get("/api/jobs/{job_id}", tags=["Jobs"])
def get_job(job_id: str):
    job = JobStore.get_instance().get_job(job_id)
    if not job:
        return {"error": f"Job '{job_id}' not found."}
    return job

@app.get("/api/jobs", tags=["Jobs"])
def list_jobs(job_type: Optional[str] = None):
    return {"jobs": JobStore.get_instance().list_jobs(job_type=job_type)}

# Transactions alias endpoints (intuitive LMS routing)
@app.get("/api/transactions/history", tags=["Transactions"])
def transactions_history(limit: int = 50):
    return books.transaction_history(limit=limit)

@app.post("/api/transactions/issue", tags=["Transactions"])
def transactions_issue(body: books.IssueRequest):
    return books.issue_book(body)

@app.post("/api/transactions/return", tags=["Transactions"])
def transactions_return(body: books.ReturnRequest):
    return books.return_book(body)


@app.get("/")
def root():
    return {"message": "Distributed Library Management System API", "docs": "/docs"}
