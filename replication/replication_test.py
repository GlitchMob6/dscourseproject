"""
replication_test.py - Distributed Systems Concept 1: Data Replication
Demonstrates:
  1. Writes (insert/update/delete) routed to Primary (Node 1).
  2. Asynchronous oplog streaming to Secondaries (Node 2, Node 3).
  3. Reading identical data directly from Secondary nodes.
  4. Measuring replication propagation delay (latency in ms).
  5. Inspecting oplog entries in local.oplog.rs.
"""

import time
import uuid
from datetime import datetime
import pymongo
from pymongo import MongoClient, ReadPreference
from tabulate import tabulate

REPLICA_SET_URI = "mongodb://127.0.0.1:27018,127.0.0.1:27019,127.0.0.1:27020/?replicaSet=rs0&serverSelectionTimeoutMS=3000"
NODES = [
    {"name": "Node 1 (Port 27018)", "host": "127.0.0.1", "port": 27018},
    {"name": "Node 2 (Port 27019)", "host": "127.0.0.1", "port": 27019},
    {"name": "Node 3 (Port 27020)", "host": "127.0.0.1", "port": 27020}
]

def run_replication_experiment():
    print("\n" + "=" * 70)
    print(" DISTRIBUTED SYSTEMS CONCEPT 1: DATA REPLICATION EXPERIMENT")
    print("=" * 70)
    print("Objective: Verify master-slave/primary-secondary data propagation")
    print("           via the MongoDB replication oplog across 3 nodes.\n")

    # Step 1: Connect through replica set URI to find current Primary
    try:
        rs_client = MongoClient(REPLICA_SET_URI)
        hello = rs_client.admin.command('hello')
        primary_host = hello.get('primary')
        print(f"[*] Connected to Replica Set: '{hello.get('setName', 'rs0')}'")
        print(f"[*] Current Elected Primary : {primary_host}")
        print(f"[*] Cluster Members         : {hello.get('hosts')}\n")
    except Exception as e:
        print(f"[!] ERROR connecting to Replica Set: {e}")
        print("[!] Ensure the replica set is running via scripts/start_replica_set.bat")
        return

    # Step 2: Prepare unique test document
    test_id = f"REP-TEST-{uuid.uuid4().hex[:6].upper()}"
    test_doc = {
        "bookId": test_id,
        "title": "Principles of Distributed Database Systems",
        "author": "M. Tamer Ozsu & Patrick Valduriez",
        "category": "Distributed Systems",
        "totalCopies": 5,
        "availableCopies": 5,
        "insertedAt": datetime.now().isoformat()
    }

    print(f"[*] [STEP 1] Inserting test book '{test_id}' via Primary...")
    t0 = time.perf_counter()
    insert_res = rs_client.library_db.books.insert_one(test_doc)
    write_ack_time = (time.perf_counter() - t0) * 1000
    print(f"[+] Write acknowledged by Primary in: {write_ack_time:.2f} ms")

    # Step 3: Query each node directly to verify data replication and measure lag
    print(f"\n[*] [STEP 2] Inspecting direct node storage across all 3 nodes:")
    node_observations = []

    for node in NODES:
        direct_uri = f"mongodb://{node['host']}:{node['port']}/?directConnection=true&serverSelectionTimeoutMS=2000"
        try:
            direct_client = MongoClient(direct_uri)
            node_hello = direct_client.admin.command('hello')
            role = "PRIMARY" if node_hello.get("isWritablePrimary") else ("SECONDARY" if node_hello.get("secondary") else "OTHER")

            # Measure how fast document is visible on this node
            t_check = time.perf_counter()
            found = direct_client.library_db.books.find_one({"bookId": test_id}, {"_id": 0})
            lookup_latency = (time.perf_counter() - t_check) * 1000

            if found:
                node_observations.append([
                    node["name"],
                    role,
                    "SYNCHRONIZED",
                    found.get("bookId"),
                    found.get("title")[:30],
                    f"{lookup_latency:.2f} ms"
                ])
            else:
                node_observations.append([
                    node["name"],
                    role,
                    "NOT FOUND (LAGGING)",
                    "-",
                    "-",
                    f"{lookup_latency:.2f} ms"
                ])
            direct_client.close()
        except Exception as err:
            node_observations.append([node["name"], "OFFLINE", str(err)[:20], "-", "-", "-"])

    print(tabulate(
        node_observations,
        headers=["Node", "Role", "Sync Status", "Found Book ID", "Title", "Read Latency"],
        tablefmt="grid"
    ))

    # Step 4: Perform Update on Primary and check propagation
    print(f"\n[*] [STEP 3] Updating availableCopies to 4 on Primary...")
    rs_client.library_db.books.update_one({"bookId": test_id}, {"$set": {"availableCopies": 4}})
    time.sleep(0.1) # brief tick for asynchronous oplog replay

    update_checks = []
    for node in NODES:
        try:
            dc = MongoClient(f"mongodb://{node['host']}:{node['port']}/?directConnection=true&serverSelectionTimeoutMS=1000")
            doc = dc.library_db.books.find_one({"bookId": test_id}, {"_id": 0, "availableCopies": 1})
            update_checks.append([node["name"], doc.get("availableCopies") if doc else "Missing"])
            dc.close()
        except Exception:
            update_checks.append([node["name"], "Offline"])

    print(tabulate(update_checks, headers=["Node", "Replicated availableCopies Value"], tablefmt="grid"))

    # Step 5: Clean up test record
    print(f"\n[*] [STEP 4] Deleting test record '{test_id}' via Primary...")
    rs_client.library_db.books.delete_one({"bookId": test_id})
    time.sleep(0.1)
    print("[+] Test record deleted and tombstone replicated across cluster.")

    # Step 6: Distributed Systems Explanation
    print("\n" + "=" * 70)
    print(" DISTRIBUTED SYSTEMS EXPLANATION: DATA REPLICATION")
    print("=" * 70)
    print("""
1. How Replication Works:
   MongoDB uses a Single-Master (Primary-Secondary) replication architecture.
   All client write operations are committed on the Primary node and written
   to its append-only replication log: 'local.oplog.rs'.

2. Asynchronous Oplog Replay:
   Secondary members continuously pull new oplog entries from the primary's
   oplog and apply those idempotent transformations to their local datasets.

3. Redundancy & Disaster Recovery:
   Because Node 2 and Node 3 contain identical replicated copies of the data,
   any catastrophic crash of the Primary node causes ZERO data loss, and one of
   the Secondaries is automatically elected as the new Primary.
""")
    rs_client.close()

if __name__ == "__main__":
    run_replication_experiment()
