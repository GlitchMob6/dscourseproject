"""
init_replica_set.py - Programmatic Replica Set rs0 Initiator
Initiates 3-member replica set (27018, 27019, 27020) and waits for Primary election.
"""

import time
import pymongo
from pymongo import MongoClient
from tabulate import tabulate

def initiate_replica_set():
    print("=" * 65)
    print(" Initiating Stage A: Replica Set 'rs0' (Ports 27018, 27019, 27020)")
    print("=" * 65)

    try:
        client = MongoClient("mongodb://127.0.0.1:27018/?directConnection=true", serverSelectionTimeoutMS=4000)
        admin = client.admin
    except Exception as e:
        print(f"[!] Failed to connect to Node 1 on port 27018: {e}")
        print("[!] Ensure Node 1 is started via scripts/start_replica_set.bat")
        return False

    config = {
        "_id": "rs0",
        "members": [
            {"_id": 0, "host": "127.0.0.1:27018", "priority": 2},
            {"_id": 1, "host": "127.0.0.1:27019", "priority": 1},
            {"_id": 2, "host": "127.0.0.1:27020", "priority": 1}
        ]
    }

    try:
        res = admin.command("replSetInitiate", config)
        print("[+] replSetInitiate command issued successfully.")
    except Exception as e:
        err_msg = str(e)
        if "already initialized" in err_msg.lower():
            print("[*] Replica set is already initiated.")
        else:
            print(f"[!] replSetInitiate notice: {e}")

    print("\n[*] Waiting for Primary election consensus...")
    elected_primary = None
    for sec in range(1, 30):
        time.sleep(1)
        try:
            hello = admin.command("hello")
            if hello.get("isWritablePrimary"):
                elected_primary = hello.get("me")
                print(f"[+] >>> PRIMARY ELECTED on {elected_primary} in {sec} seconds! <<<")
                break
            else:
                print(f"    - [{sec}s] Convergence in progress (Current node state: secondary={hello.get('secondary')})...")
        except Exception:
            pass

    # Print summary status
    try:
        status = admin.command("replSetGetStatus")
        members = status.get("members", [])
        table = []
        for m in members:
            table.append([
                m.get("_id"),
                m.get("name"),
                m.get("stateStr"),
                "HEALTHY (1)" if m.get("health") == 1 else "FAILED (0)",
                f"{m.get('uptime', 0)}s"
            ])
        print("\n--- Replica Set Members Summary ---")
        print(tabulate(table, headers=["ID", "Host", "Role / State", "Health", "Uptime"], tablefmt="grid"))
    except Exception as e:
        print(f"[!] Could not query replSetGetStatus: {e}")

    client.close()
    return True

if __name__ == "__main__":
    initiate_replica_set()
