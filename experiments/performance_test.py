"""
performance_test.py - Distributed Systems Concept 7: Horizontal Scalability & Performance
Benchmark comparing:
  1. Standalone MongoDB Instance (localhost:27017)
  2. 3-Node Replica Set (localhost:27018, 27019, 27020)
  3. Sharded Cluster with Query Router (localhost:27050)
Metrics:
  - Insertion Time (ms) & Throughput (docs/sec)
  - Point Query Latency (ms)
  - Range/Aggregated Query Latency (ms)
  - Exports measured results to experiments/benchmark_run_results.csv
"""

import time
import csv
import os
import pymongo
from pymongo import MongoClient
from tabulate import tabulate
from experiments.generate_dataset import generate_books

STANDALONE_URI = "mongodb://127.0.0.1:27017/?serverSelectionTimeoutMS=2000"
REPLICA_SET_URI = "mongodb://127.0.0.1:27018,127.0.0.1:27019,127.0.0.1:27020/?replicaSet=rs0&serverSelectionTimeoutMS=2000"
SHARDED_URI = "mongodb://127.0.0.1:27050/?serverSelectionTimeoutMS=2000"

DATASET_SIZE = 1000

def check_connection(uri, label):
    try:
        c = MongoClient(uri)
        c.admin.command('ping')
        c.close()
        return True
    except Exception:
        return False

def benchmark_architecture(name, uri, books_data):
    print(f"\n[*] Benchmarking [{name}] ({uri[:35]}...)...")
    try:
        client = MongoClient(uri)
        db = client["benchmark_db"]
        coll = db["perf_books"]

        # Clean prior test collection
        coll.drop()
        coll.create_index([("bookId", 1)], unique=True)
        coll.create_index([("category", 1)])

        # 1. Bulk Insertion Benchmark
        t_insert_start = time.perf_counter()
        coll.insert_many(books_data, ordered=False)
        insert_time_sec = time.perf_counter() - t_insert_start
        throughput = len(books_data) / insert_time_sec
        avg_insert_lat_ms = (insert_time_sec / len(books_data)) * 1000

        # 2. Point Query Benchmark (Indexed key)
        point_latencies = []
        sample_ids = [f"BK-{i:05d}" for i in range(100, 200)]
        for bid in sample_ids:
            t0 = time.perf_counter()
            coll.find_one({"bookId": bid})
            point_latencies.append((time.perf_counter() - t0) * 1000)
        avg_point_ms = sum(point_latencies) / len(point_latencies)

        # 3. Range Query Benchmark
        range_latencies = []
        for cat in ["Computer Science", "Physics", "Mathematics"]:
            t0 = time.perf_counter()
            list(coll.find({"category": cat}))
            range_latencies.append((time.perf_counter() - t0) * 1000)
        avg_range_ms = sum(range_latencies) / len(range_latencies)

        # Cleanup
        coll.drop()
        client.close()

        return {
            "Architecture": name,
            "Dataset Size": len(books_data),
            "Insert Time (s)": round(insert_time_sec, 3),
            "Throughput (docs/s)": round(throughput, 1),
            "Avg Insert Latency (ms)": round(avg_insert_lat_ms, 3),
            "Point Query Latency (ms)": round(avg_point_ms, 3),
            "Range Query Latency (ms)": round(avg_range_ms, 3),
            "Status": "COMPLETED"
        }
    except Exception as e:
        return {
            "Architecture": name,
            "Dataset Size": len(books_data),
            "Insert Time (s)": "N/A",
            "Throughput (docs/s)": "N/A",
            "Avg Insert Latency (ms)": "N/A",
            "Point Query Latency (ms)": "N/A",
            "Range Query Latency (ms)": "N/A",
            "Status": f"OFFLINE ({e.__class__.__name__})"
        }

def run_performance_comparison():
    print("\n" + "=" * 80)
    print(" DISTRIBUTED SYSTEMS CONCEPT 7: PERFORMANCE & HORIZONTAL SCALABILITY")
    print("=" * 80)
    print(f"Dataset: Generating {DATASET_SIZE} reproducible synthetic book records...\n")

    books = generate_books(DATASET_SIZE)

    targets = [
        ("Standalone Node (27017)", STANDALONE_URI),
        ("3-Node Replica Set (rs0)", REPLICA_SET_URI),
        ("Sharded Cluster (mongos 27050)", SHARDED_URI)
    ]

    results = []
    for name, uri in targets:
        res = benchmark_architecture(name, uri, books)
        results.append(res)

    print("\n" + "=" * 80)
    print(" PERFORMANCE BENCHMARK COMPARISON TABLE")
    print("=" * 80)

    table_data = []
    for r in results:
        table_data.append([
            r["Architecture"],
            r["Dataset Size"],
            r["Insert Time (s)"],
            r["Throughput (docs/s)"],
            r["Point Query Latency (ms)"],
            r["Range Query Latency (ms)"],
            r["Status"]
        ])

    headers = ["Architecture", "Records", "Insert Time", "Throughput", "Point Read (ms)", "Range Read (ms)", "Status"]
    print(tabulate(table_data, headers=headers, tablefmt="grid"))

    # Save to CSV
    csv_file = "experiments/benchmark_run_results.csv"
    try:
        with open(csv_file, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=results[0].keys())
            writer.writeheader()
            writer.writerows(results)
        print(f"\n[+] Empirical measurements saved to {csv_file}")
    except Exception as e:
        print(f"[!] Error writing CSV: {e}")

    # Theoretical Scalability Insight
    print("\n" + "=" * 80)
    print(" DISTRIBUTED SYSTEMS INSIGHT: SCALABILITY ON SINGLE HARDWARE VS CLUSTER")
    print("=" * 80)
    print("""
Key Observations & Academic Analysis:
1. Why Distributed Writes May Show Higher Latency on a Single Laptop:
   - In a Standalone MongoDB instance, writes commit directly to one memory/disk engine.
   - In a Replica Set, every write generates oplog entries that must be replicated.
   - In a Sharded Cluster, mongos must analyze chunk routing rules and dispatch network
     packets over TCP sockets. When running all nodes on the same laptop, all mongod
     processes contend for the SAME physical disk and CPU cores.

2. Where Horizontal Sharding Scales Linearly in Production:
   - When each shard lives on an INDEPENDENT PHYSICAL SERVER:
     * Disk I/O capacity is multiplied by N shards.
     * RAM caching (WiredTiger cache) is multiplied by N shards.
     * Total write/read bandwidth scales horizontally beyond the ceiling of any single box.

3. Redundancy vs Raw Speed Tradeoff:
   - Replication trades minor latency overhead for 100% data redundancy and automatic failover.
""")

if __name__ == "__main__":
    run_performance_comparison()
