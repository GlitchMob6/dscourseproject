"""
sharding_test.py - Distributed Systems Concept 4: Data Sharding
Demonstrates:
  1. Connection through mongos Query Router (port 27050).
  2. Inspecting Shard configuration (shard1-rs and shard2-rs).
  3. Verifying horizontal partitioning of collection 'library_db.books'.
  4. Inspecting chunk distributions and shard balance.
  5. Analyzing Shard Key selection: { category: 1, bookId: 1 }.
"""

import pymongo
from pymongo import MongoClient
from tabulate import tabulate

MONGOS_URI = "mongodb://127.0.0.1:27050/?serverSelectionTimeoutMS=3000"

def run_sharding_verification():
    print("\n" + "=" * 75)
    print(" DISTRIBUTED SYSTEMS CONCEPT 4: DATA SHARDING EXPERIMENT")
    print("=" * 75)
    print("Objective: Verify Horizontal Partitioning (Sharding) across")
    print("           independent physical database nodes via the mongos router.\n")

    try:
        client = MongoClient(MONGOS_URI)
        hello = client.admin.command('hello')
        if hello.get('msg') != 'isdbgrid':
            print("[!] Connected server is NOT a mongos query router!")
            print(f"    Hello returned: {hello.get('msg')}")
            print("[!] Please start the sharded cluster via scripts/start_sharded_cluster.bat")
            return
        print("[+] Verified connection to 'mongos' Query Router on port 27050.")
    except Exception as e:
        print(f"[!] Could not connect to mongos at {MONGOS_URI}: {e}")
        print("[!] Ensure the sharded cluster is started via scripts/start_sharded_cluster.bat and initialized.")
        return

    admin = client.admin
    config_db = client.config
    db = client.library_db

    # 1. List Registered Shards
    try:
        shards_info = admin.command('listShards')
        shard_list = shards_info.get('shards', [])
        table_shards = []
        for s in shard_list:
            table_shards.append([s.get('_id'), s.get('host'), s.get('state', 1)])
        print("\n--- Active Shards Registered in Cluster ---")
        print(tabulate(table_shards, headers=["Shard Name", "Replica Set / Host", "State"], tablefmt="grid"))
    except Exception as e:
        print(f"[!] Error querying listShards: {e}")

    # 2. Check Database and Collection Sharding Status
    print("\n--- Sharding Status for Database 'library_db' ---")
    try:
        db_conf = config_db.databases.find_one({"_id": "library_db"})
        if db_conf:
            print(f"[*] Database Primary Shard : {db_conf.get('primary')}")
            print(f"[*] Partitioned / Sharded  : {db_conf.get('partitioned')}")
        else:
            print("[-] Database 'library_db' not yet recorded in config database.")

        coll_conf = config_db.collections.find_one({"_id": "library_db.books"})
        if coll_conf:
            print(f"[*] Collection 'books' Sharded : True")
            print(f"[*] Configured Shard Key       : {coll_conf.get('key')}")
            print(f"[*] Unique Constraint          : {coll_conf.get('unique', False)}")
        else:
            print("[-] Collection 'library_db.books' is not yet sharded.")
    except Exception as e:
        print(f"[!] Error inspecting config db: {e}")

    # 3. Document Count & Distribution Across Shards
    total_books = db.books.count_documents({})
    print(f"\n[*] Total Books currently stored in 'library_db.books': {total_books}")

    if total_books > 0:
        print("\n[*] Inspecting Data Distribution by Shard:")
        try:
            # Query collection stats per shard
            stats = db.command("collStats", "books")
            shards_data = stats.get("shards", {})
            dist_rows = []
            for shard_id, shard_stat in shards_data.items():
                count = shard_stat.get("count", 0)
                size_kb = shard_stat.get("size", 0) / 1024
                pct = (count / total_books * 100) if total_books > 0 else 0
                dist_rows.append([shard_id, count, f"{size_kb:.2f} KB", f"{pct:.1f}%"])

            print(tabulate(dist_rows, headers=["Shard ID", "Document Count", "Data Size (KB)", "% of Total Data"], tablefmt="grid"))
        except Exception as e:
            # Fallback by direct query if collStats is restricted
            print(f"[Note on collStats]: {e}")

        # 4. Chunks distribution
        try:
            # In MongoDB 5.0+, chunks can be in config.chunks or config.chunk_history
            chunks = list(config_db.chunks.find({"ns": "library_db.books"}, {"_id": 0, "history": 0}).limit(10))
            if chunks:
                print(f"\n--- Data Chunks Sample ({len(chunks)} displayed) ---")
                chunk_rows = []
                for c in chunks:
                    chunk_rows.append([c.get("shard"), str(c.get("min")), str(c.get("max"))])
                print(tabulate(chunk_rows, headers=["Holding Shard", "Lower Bound (Min)", "Upper Bound (Max)"], tablefmt="grid"))
        except Exception:
            pass
    else:
        print("[!] Tip: Generate synthetic records (Option 15/experiments) to observe chunk balancing.")

    # 5. Distributed Systems Sharding Principles
    print("\n" + "=" * 75)
    print(" DISTRIBUTED SYSTEMS EXPLANATION: HORIZONTAL PARTITIONING")
    print("=" * 75)
    print("""
1. Vertical vs. Horizontal Scaling:
   - Vertical scaling (Scale-Up): Adding more RAM/CPUs to a single machine.
     Hit physical hardware limits and costs grow exponentially.
   - Horizontal scaling (Scale-Out / Sharding): Partitioning data across multiple
     independent commodity server nodes. Storage and compute scale linearly!

2. Anatomy of MongoDB Sharded Cluster:
   a. Shard Nodes (shard1-rs, shard2-rs): Store physical data chunks.
   b. Config Server (cfg-rs): Stores cluster metadata, chunk mappings, and routing tables.
   c. mongos Query Router: Stateless interface that intercepts client queries,
      consults cached config metadata, and routes queries directly to relevant shards.

3. Shard Key Selection Importance:
   - A good shard key produces high cardinality, uniform chunk distribution,
     and allows query routing targeting (preventing global scatter-gather).
""")
    client.close()

if __name__ == "__main__":
    run_sharding_verification()
