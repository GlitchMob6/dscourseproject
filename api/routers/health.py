"""
Health & overview router — database connectivity, cluster status, collection stats.
"""

from fastapi import APIRouter
from app.database import DatabaseManager, REPLICA_SET_URI, SHARDED_CLUSTER_URI, STANDALONE_URI
from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError, ConnectionFailure

router = APIRouter()


@router.get("")
def health_check():
    """Return current connection status, cluster mode, and basic stats."""
    try:
        db_mgr = DatabaseManager.get_instance()
        cluster = db_mgr.get_cluster_status()
        db = db_mgr.get_db()

        # Collection counts
        try:
            book_count = db.books.count_documents({})
        except Exception:
            book_count = None
        try:
            member_count = db.members.count_documents({})
        except Exception:
            member_count = None
        try:
            transaction_count = db.transactions.count_documents({})
        except Exception:
            transaction_count = None
        try:
            active_issues = db.transactions.count_documents({"status": "ISSUED"})
        except Exception:
            active_issues = None

        return {
            "connected": True,
            "mode": cluster.get("mode", "UNKNOWN"),
            "uri": cluster.get("uri", ""),
            "primary_host": cluster.get("primary_host", "N/A"),
            "set_name": cluster.get("set_name", "N/A"),
            "is_primary": cluster.get("is_primary", False),
            "hosts": cluster.get("hosts", []),
            "msg": cluster.get("msg", ""),
            "stats": {
                "books": book_count,
                "members": member_count,
                "transactions": transaction_count,
                "active_issues": active_issues,
            }
        }
    except Exception as e:
        return {
            "connected": False,
            "mode": "UNKNOWN",
            "error": str(e),
            "stats": {"books": None, "members": None, "transactions": None, "active_issues": None}
        }


@router.post("/switch")
def switch_mode(mode: str):
    """Switch cluster connection mode: REPLICA_SET, SHARDED, or STANDALONE."""
    if mode not in ("REPLICA_SET", "SHARDED", "STANDALONE"):
        return {"success": False, "message": f"Invalid mode '{mode}'. Use REPLICA_SET, SHARDED, or STANDALONE."}
    try:
        db_mgr = DatabaseManager.get_instance()
        success, message = db_mgr.switch_cluster_mode(mode)
        return {"success": success, "message": message, "mode": db_mgr.current_mode}
    except Exception as e:
        return {"success": False, "message": str(e)}


@router.get("/connectivity")
def check_all_connectivity():
    """Probe all three MongoDB topologies and report availability."""
    results = {}
    for label, uri in [("standalone", STANDALONE_URI), ("replica_set", REPLICA_SET_URI), ("sharded", SHARDED_CLUSTER_URI)]:
        c = None
        try:
            c = MongoClient(uri, serverSelectionTimeoutMS=2000)
            c.admin.command("ping")
            hello = c.admin.command("hello")
            results[label] = {
                "available": True,
                "primary": hello.get("primary", hello.get("me", "N/A")),
                "set_name": hello.get("setName", "N/A"),
                "is_mongos": hello.get("msg") == "isdbgrid",
            }
        except Exception as e:
            results[label] = {"available": False, "error": str(e)}
        finally:
            if c:
                try:
                    c.close()
                except Exception:
                    pass
    return results


@router.get("/recent-transactions")
def recent_transactions():
    """Return the 10 most recent library transactions."""
    try:
        db_mgr = DatabaseManager.get_instance()
        db = db_mgr.get_db()
        txns = list(db.transactions.find({}, {"_id": 0}).sort("issueDate", -1).limit(10))
        return {"transactions": txns}
    except Exception as e:
        return {"transactions": [], "error": str(e)}
