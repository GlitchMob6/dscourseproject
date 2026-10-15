"""
Distributed query analysis router — wraps distributed_query_test.py.
"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
from pymongo import MongoClient

router = APIRouter()

MONGOS_URI = "mongodb://127.0.0.1:27050/?serverSelectionTimeoutMS=3000"

# Predefined example queries
EXAMPLE_QUERIES = [
    {"name": "Targeted: by category", "filter": {"category": "Computer Science"}, "description": "Shard key prefix — routes to specific shard"},
    {"name": "Targeted: category + bookId", "filter": {"category": "Computer Science", "bookId": "BK-00001"}, "description": "Full shard key — routes to exact chunk"},
    {"name": "Scatter-Gather: by author", "filter": {"author": "Martin Kleppmann"}, "description": "Non-shard-key field — broadcasts to all shards"},
    {"name": "Scatter-Gather: by title", "filter": {"title": {"$regex": "Distributed", "$options": "i"}}, "description": "Non-shard-key regex — scatter-gather"},
]


@router.get("/examples")
def get_example_queries():
    """List predefined query examples."""
    return {"queries": EXAMPLE_QUERIES}


class QueryRequest(BaseModel):
    filter: dict
    name: Optional[str] = "Custom Query"


@router.post("/analyze")
def analyze_query(body: QueryRequest):
    """Run explain() on a query through mongos and return the execution plan."""
    try:
        client = MongoClient(MONGOS_URI)
        hello = client.admin.command("hello")
        if hello.get("msg") != "isdbgrid":
            return {"error": "Not connected to a mongos router. Start the sharded cluster first."}
    except Exception as e:
        return {"error": f"Could not connect to mongos: {e}"}

    db = client.library_db

    try:
        explain_result = db.command(
            "explain",
            {"find": "books", "filter": body.filter},
            verbosity="executionStats",
        )

        query_planner = explain_result.get("queryPlanner", {})
        winning_plan = query_planner.get("winningPlan", {})
        exec_stats = explain_result.get("executionStats", {})

        # Determine routing type
        shards_involved = []
        stage = winning_plan.get("stage", "N/A")

        if "shards" in winning_plan:
            for s in winning_plan["shards"]:
                shards_involved.append(s.get("shardName", "unknown"))
        elif "shards" in exec_stats:
            for s in exec_stats["shards"]:
                shards_involved.append(s.get("shardName", "unknown"))

        # Classify
        is_shard_key_filter = any(
            k in body.filter for k in ["category", "bookId"]
        )
        is_targeted = stage == "SINGLE_SHARD" or (len(shards_involved) == 1 and is_shard_key_filter)
        routing_type = "TARGETED" if is_targeted else "SCATTER_GATHER"

        # Execution stats
        total_docs_examined = exec_stats.get("totalDocsExamined", "N/A")
        total_keys_examined = exec_stats.get("totalKeysExamined", "N/A")
        n_returned = exec_stats.get("nReturned", "N/A")
        exec_time_ms = exec_stats.get("executionTimeMillis", "N/A")

        client.close()

        return {
            "query": body.filter,
            "queryName": body.name,
            "routingType": routing_type,
            "stage": stage,
            "shardsInvolved": shards_involved,
            "totalShardsInCluster": len(shards_involved) if shards_involved else "unknown",
            "executionStats": {
                "nReturned": n_returned,
                "totalDocsExamined": total_docs_examined,
                "totalKeysExamined": total_keys_examined,
                "executionTimeMillis": exec_time_ms,
            },
            "explanation": _get_explanation(routing_type, body.filter, shards_involved),
            "rawPlan": {
                "queryPlanner": query_planner,
                "executionStats": {
                    k: v for k, v in exec_stats.items()
                    if k not in ("allPlansExecution",)
                },
            },
        }
    except Exception as e:
        client.close()
        return {"error": str(e)}


def _get_explanation(routing_type, query_filter, shards):
    if routing_type == "TARGETED":
        return (
            f"This query includes the shard key prefix in its filter ({list(query_filter.keys())}). "
            f"The mongos router used its cached chunk-to-shard mapping to route the query directly to "
            f"{len(shards)} shard(s): {shards}. No other shards were contacted, minimizing network overhead."
        )
    else:
        return (
            f"This query filters on non-shard-key fields ({list(query_filter.keys())}). "
            f"The mongos router cannot determine which shard holds matching documents, so it broadcasts "
            f"the query to all shards ({shards}), waits for partial results, and performs a SHARD_MERGE "
            f"to assemble the final result set. This is less efficient than targeted routing."
        )
