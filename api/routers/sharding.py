"""
Sharding status router — wraps sharding_test.py for the UI.
"""

from fastapi import APIRouter
from pymongo import MongoClient

router = APIRouter()

MONGOS_URI = "mongodb://127.0.0.1:27050/?serverSelectionTimeoutMS=3000"


@router.get("/status")
def sharding_status():
    """Get comprehensive sharding cluster status."""
    try:
        client = MongoClient(MONGOS_URI)
        hello = client.admin.command("hello")
        if hello.get("msg") != "isdbgrid":
            return {"connected": False, "error": "Connected server is not a mongos router."}
    except Exception as e:
        return {"connected": False, "error": str(e)}

    result = {"connected": True, "isMongos": True}

    # Shards
    try:
        shards_info = client.admin.command("listShards")
        result["shards"] = [
            {"id": s.get("_id"), "host": s.get("host"), "state": s.get("state", 1)}
            for s in shards_info.get("shards", [])
        ]
    except Exception as e:
        result["shards"] = []
        result["shardsError"] = str(e)

    # Database config
    try:
        db_conf = client.config.databases.find_one({"_id": "library_db"})
        if db_conf:
            result["database"] = {
                "primaryShard": db_conf.get("primary"),
                "partitioned": db_conf.get("partitioned"),
            }
    except Exception:
        pass

    # Collection sharding config
    try:
        coll_conf = client.config.collections.find_one({"_id": "library_db.books"})
        if coll_conf:
            result["collection"] = {
                "sharded": True,
                "shardKey": coll_conf.get("key"),
                "unique": coll_conf.get("unique", False),
            }
        else:
            result["collection"] = {"sharded": False}
    except Exception:
        result["collection"] = {"sharded": False}

    # Document distribution
    db = client.library_db
    try:
        total = db.books.count_documents({})
        result["totalBooks"] = total

        if total > 0:
            stats = db.command("collStats", "books")
            shards_data = stats.get("shards", {})
            distribution = []
            for shard_id, shard_stat in shards_data.items():
                count = shard_stat.get("count", 0)
                size_kb = round(shard_stat.get("size", 0) / 1024, 2)
                pct = round((count / total * 100), 1) if total > 0 else 0
                distribution.append({
                    "shard": shard_id,
                    "count": count,
                    "sizeKB": size_kb,
                    "percentage": pct,
                })
            result["distribution"] = distribution
    except Exception as e:
        result["distributionError"] = str(e)

    # Chunks
    try:
        chunks = list(client.config.chunks.find(
            {"ns": "library_db.books"}, {"_id": 0, "history": 0}
        ).limit(20))
        result["chunks"] = [
            {"shard": c.get("shard"), "min": str(c.get("min")), "max": str(c.get("max"))}
            for c in chunks
        ]
    except Exception:
        # MongoDB 6.0+ may use uuid-based collection references
        try:
            coll_entry = client.config.collections.find_one({"_id": "library_db.books"})
            if coll_entry and "uuid" in coll_entry:
                chunks = list(client.config.chunks.find(
                    {"uuid": coll_entry["uuid"]}, {"_id": 0, "history": 0}
                ).limit(20))
                result["chunks"] = [
                    {"shard": c.get("shard"), "min": str(c.get("min")), "max": str(c.get("max"))}
                    for c in chunks
                ]
        except Exception:
            result["chunks"] = []

    client.close()
    return result
