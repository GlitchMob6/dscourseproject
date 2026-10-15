"""
init_sharded_cluster.py - Programmatic Sharded Cluster Initializer
Automates:
  1. Initiating config server replica set (cfg-rs on 27100)
  2. Initiating shard replica sets (shard1-rs on 27200, shard2-rs on 27300)
  3. Starting mongos router process on port 27050
  4. Registering shards with mongos
  5. Enabling sharding on library_db and sharding collection books on { category: 1, bookId: 1 }
"""

import sys
import os
import time
import subprocess
import pymongo
from pymongo import MongoClient
from tabulate import tabulate

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def init_replica_set_member(port, rs_name, is_config=False):
    print(f"[*] Initiating replica set '{rs_name}' on port {port}...")
    try:
        c = MongoClient(f"mongodb://127.0.0.1:{port}/?directConnection=true", serverSelectionTimeoutMS=3000)
        cfg = {
            "_id": rs_name,
            "members": [{"_id": 0, "host": f"127.0.0.1:{port}"}]
        }
        if is_config:
            cfg["configsvr"] = True
        c.admin.command("replSetInitiate", cfg)
        print(f" [+] [Port {port}] '{rs_name}' initiated.")
        c.close()
    except Exception as e:
        if "already initialized" in str(e).lower():
            print(f" [*] [Port {port}] '{rs_name}' is already initialized.")
        else:
            print(f" [!] [Port {port}] '{rs_name}' note: {e}")

def start_mongos_if_needed():
    # Check if mongos is already running on 27050
    try:
        test_c = MongoClient("mongodb://127.0.0.1:27050/?serverSelectionTimeoutMS=1000")
        test_c.admin.command("ping")
        test_c.close()
        print("[+] mongos Query Router is already running on port 27050.")
        return True
    except Exception:
        pass

    import glob
    import shutil
    mongos_matches = glob.glob(r"C:\Program Files\MongoDB\Server\*\bin\mongos.exe")
    if mongos_matches:
        mongos_path = sorted(mongos_matches, reverse=True)[0]
    else:
        m_find = shutil.which("mongos")
        if m_find:
            mongos_path = m_find
        else:
            print("[!] mongos.exe not found. Ensure MongoDB Community Server is installed.")
            return False

    log_dir = os.path.join(PROJECT_ROOT, "data", "logs")
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, "mongos.log")

    cmd = [
        mongos_path,
        "--configdb", "cfg-rs/127.0.0.1:27100",
        "--port", "27050",
        "--logpath", log_file,
        "--bind_ip", "127.0.0.1"
    ]

    print(f"[*] Spawning mongos process on port 27050...")
    flags = 0
    if sys.platform == "win32":
        flags = subprocess.CREATE_NEW_PROCESS_GROUP
        if hasattr(subprocess, "DETACHED_PROCESS"):
            flags |= subprocess.DETACHED_PROCESS

    subprocess.Popen(cmd, creationflags=flags)
    
    # Wait for mongos to listen
    for _ in range(15):
        time.sleep(1)
        try:
            c = MongoClient("mongodb://127.0.0.1:27050/?serverSelectionTimeoutMS=1000")
            c.admin.command("ping")
            c.close()
            print("[+] mongos Query Router is online and listening on port 27050!")
            return True
        except Exception:
            pass
    print("[!] mongos failed to respond on port 27050 within 15 seconds.")
    return False

def configure_shards_and_collections():
    print("\n[*] Connecting to mongos on port 27050 to configure cluster topology...")
    try:
        client = MongoClient("mongodb://127.0.0.1:27050/?serverSelectionTimeoutMS=5000")
        admin = client.admin

        # 1. Add Shards
        for shard_target in ["shard1-rs/127.0.0.1:27200", "shard2-rs/127.0.0.1:27300"]:
            try:
                res = admin.command("addShard", shard_target)
                print(f" [+] Shard '{shard_target}' added: {res.get('ok') == 1.0}")
            except Exception as e:
                if "already exists" in str(e).lower():
                    print(f" [*] Shard '{shard_target}' is already registered.")
                else:
                    print(f" [!] addShard note for '{shard_target}': {e}")

        # 2. Enable Sharding on database library_db
        try:
            res_sh = admin.command("enableSharding", "library_db")
            print(f" [+] Database 'library_db' sharded: {res_sh.get('ok') == 1.0}")
        except Exception as e:
            if "already enabled" in str(e).lower():
                print(" [*] Database 'library_db' sharding is already enabled.")
            else:
                print(f" [!] enableSharding note: {e}")

        # 3. Create compound index and shard collection books
        db = client["library_db"]
        try:
            db.books.create_index([("category", 1), ("bookId", 1)])
            res_coll = admin.command(
                "shardCollection",
                "library_db.books",
                key={"category": 1, "bookId": 1}
            )
            print(f" [+] Collection 'library_db.books' sharded on {{ category: 1, bookId: 1 }}: {res_coll.get('ok') == 1.0}")
        except Exception as e:
            if "already sharded" in str(e).lower():
                print(" [*] Collection 'library_db.books' is already sharded.")
            else:
                print(f" [!] shardCollection note: {e}")

        # 4. Print summary
        try:
            shards_info = admin.command("listShards")
            shard_list = shards_info.get("shards", [])
            table = [[s.get("_id"), s.get("host"), s.get("state", 1)] for s in shard_list]
            print("\n--- Registered Shards in Cluster ---")
            print(tabulate(table, headers=["Shard Name", "Replica Set Target", "State"], tablefmt="grid"))
        except Exception:
            pass

        client.close()
        return True
    except Exception as e:
        print(f"[!] Error configuring sharded cluster via mongos: {e}")
        return False

def main():
    print("=" * 65)
    print(" Initializing Stage B: Sharded Cluster (Ports 27100, 27200, 27300, 27050)")
    print("=" * 65)

    init_replica_set_member(27100, "cfg-rs", is_config=True)
    init_replica_set_member(27200, "shard1-rs")
    init_replica_set_member(27300, "shard2-rs")
    time.sleep(3)

    if start_mongos_if_needed():
        configure_shards_and_collections()
        print("\n[+] Stage B Sharded Cluster Initialization Complete!")
    else:
        print("\n[!] Stage B initialization incomplete due to mongos startup failure.")

if __name__ == "__main__":
    main()
