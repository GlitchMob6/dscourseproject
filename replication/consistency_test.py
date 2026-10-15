"""
consistency_test.py - Distributed Systems Concept 5: Data Consistency
Demonstrates:
  1. Write Concerns:
     - w: 1 (Acknowledged once written to standalone memory/Primary oplog)
     - w: "majority" (Acknowledged only after committed to majority of nodes)
  2. Read Preferences:
     - primary: Strict consistency (Reads latest state from master)
     - secondary: Eventual consistency (May observe replication lag)
     - nearest: Lowest network latency
  3. Latency comparison and Replication Lag measurement.
"""

import time
import uuid
import pymongo
from pymongo import MongoClient, ReadPreference, WriteConcern
from tabulate import tabulate

REPLICA_SET_URI = "mongodb://127.0.0.1:27018,127.0.0.1:27019,127.0.0.1:27020/?replicaSet=rs0&serverSelectionTimeoutMS=3000"

def run_consistency_experiment():
    print("\n" + "=" * 75)
    print(" DISTRIBUTED SYSTEMS CONCEPT 5: DATA CONSISTENCY EXPERIMENT")
    print("=" * 75)
    print("Objective: Evaluate CAP theorem tradeoffs between Consistency & Latency")
    print("           using MongoDB Write Concerns and Read Preferences.\n")

    try:
        client = MongoClient(REPLICA_SET_URI)
        client.admin.command('ping')
    except Exception as e:
        print(f"[!] Replica Set connection failed: {e}")
        print("[!] Ensure Replica Set rs0 is running.")
        return

    db = client.library_db

    # -------------------------------------------------------------
    # PART 1: Write Concern Latency Comparison (w:1 vs w:majority)
    # -------------------------------------------------------------
    print("[*] PART 1: Comparing Write Concern Durability vs Latency...")
    iterations = 20

    # Test w: 1
    db_w1 = client.get_database("library_db", write_concern=WriteConcern(w=1, wtimeout=5000))
    latencies_w1 = []
    for i in range(iterations):
        doc = {"bookId": f"CONS-W1-{i}", "title": f"Consistency Study W1 #{i}", "copies": 1}
        t0 = time.perf_counter()
        db_w1.books.insert_one(doc)
        latencies_w1.append((time.perf_counter() - t0) * 1000)

    # Test w: "majority"
    db_wmaj = client.get_database("library_db", write_concern=WriteConcern(w="majority", wtimeout=5000))
    latencies_wmaj = []
    for i in range(iterations):
        doc = {"bookId": f"CONS-WMAJ-{i}", "title": f"Consistency Study Majority #{i}", "copies": 1}
        t0 = time.perf_counter()
        db_wmaj.books.insert_one(doc)
        latencies_wmaj.append((time.perf_counter() - t0) * 1000)

    avg_w1 = sum(latencies_w1) / len(latencies_w1)
    avg_wmaj = sum(latencies_wmaj) / len(latencies_wmaj)

    # Clean up test docs
    db.books.delete_many({"bookId": {"$regex": "^CONS-"}})

    write_table = [
        ["w: 1 (Primary Only)", f"{min(latencies_w1):.2f} ms", f"{max(latencies_w1):.2f} ms", f"{avg_w1:.2f} ms", "Low Durability (Fast)"],
        ["w: 'majority' (Quorum)", f"{min(latencies_wmaj):.2f} ms", f"{max(latencies_wmaj):.2f} ms", f"{avg_wmaj:.2f} ms", "Strong Durability (Safe)"]
    ]
    print(tabulate(write_table, headers=["Write Concern", "Min Latency", "Max Latency", "Avg Latency", "Guaranteed Durability"], tablefmt="grid"))

    # -------------------------------------------------------------
    # PART 2: Read Preferences and Eventual Consistency
    # -------------------------------------------------------------
    print("\n[*] PART 2: Read Preferences and Read Visibility Analysis...")
    read_modes = [
        ("primary", ReadPreference.PRIMARY, "Strict / Linearizable (always up-to-date)"),
        ("secondary", ReadPreference.SECONDARY, "Eventual Consistency (may read slightly stale)"),
        ("secondaryPreferred", ReadPreference.SECONDARY_PREFERRED, "Reads secondary; falls back to primary"),
        ("nearest", ReadPreference.NEAREST, "Lowest round-trip network ping")
    ]

    read_results = []
    probe_id = f"PROBE-{uuid.uuid4().hex[:6].upper()}"
    # Insert with w:1 on primary
    db_w1.books.insert_one({"bookId": probe_id, "title": "Realtime Update Probe", "version": 1})

    for mode_name, pref, description in read_modes:
        db_read = client.get_database("library_db", read_preference=pref)
        t_start = time.perf_counter()
        doc = db_read.books.find_one({"bookId": probe_id})
        t_read = (time.perf_counter() - t_start) * 1000
        found = "Found (v1)" if doc else "Not Found (Lagging)"
        read_results.append([mode_name, description, found, f"{t_read:.2f} ms"])

    db.books.delete_one({"bookId": probe_id})

    print(tabulate(read_results, headers=["Read Preference", "Consistency Semantic", "Probe Visibility", "Query Latency"], tablefmt="grid"))

    # -------------------------------------------------------------
    # PART 3: Theoretical Consistency Models in Distributed Systems
    # -------------------------------------------------------------
    print("\n" + "=" * 75)
    print(" DISTRIBUTED SYSTEMS EXPLANATION: CONSISTENCY SPECTRUM")
    print("=" * 75)
    print("""
1. Strict Consistency (Linearizability):
   - Configured with `readPreference=primary` and `w="majority"`.
   - Every read is guaranteed to return the most recently committed write.
   - Trade-off: Lower read throughput because all queries hit the Primary.

2. Eventual Consistency:
   - Configured with `readPreference=secondary`.
   - Reads are distributed across secondary nodes, maximizing horizontal read
     scalability.
   - Trade-off: If network congestion or replication lag occurs, a client
     might read data from a few milliseconds in the past.

3. PACELC Theorem Extension of CAP:
   - If there is a Partition (P), trade Availability (A) vs Consistency (C).
   - Else (E), trade Latency (L) vs Consistency (C).
   - Using `w: 'majority'` increases Latency (L) to deliver high Consistency (C).
""")
    client.close()

if __name__ == "__main__":
    run_consistency_experiment()
