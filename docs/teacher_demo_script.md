# TEACHER & EXAMINER DEMONSTRATION GUIDE (STEP-BY-STEP)
## Project: Implementation of Distributed Databases Using MongoDB — Library Management System

This guide is designed for your college project demonstration and viva. It gives you the **exact sequence of clicks, terminal commands, screen layout, and verbal explanations** to show your teacher ("Mam") to secure top marks.

---

## 1. Preparation & Desktop Setup Before Calling Mam

### Recommended Screen Layout (Split Screen)
- **Left Half of Screen**: PowerShell / Command Prompt running the Python Application:
  ```powershell
  cd "C:\Users\HP\Desktop\Distributed system"
  .\run_app.bat
  ```
- **Right Half of Screen**: A second Command Prompt running MongoDB Shell (`mongosh`) to verify database internals live:
  ```powershell
  mongosh --port 27018
  ```

---

## 2. Step-by-Step Concept Demonstration Script

### STEP 0: Show Architecture & Initialization
1. Open PowerShell and run:
   ```powershell
   cd "C:\Users\HP\Desktop\Distributed system"
   .\scripts\start_replica_set.bat
   .\scripts\init_replica_set.bat
   ```
2. **What to say to Mam**:
   > *"Mam, in our distributed database architecture, we have avoided a single-point-of-failure by setting up a 3-node MongoDB Replica Set named `rs0`. Node 1 runs on port 27018, Node 2 runs on port 27019, and Node 3 runs on port 27020. Each node has its own separate physical storage directory on disk."*
3. Show option **10** in `main.py` (`Display Replica Set Status`).
   - Point out: `Node 1` has `state: PRIMARY`, `Node 2` and `Node 3` have `state: SECONDARY`.
   - Point out that all 3 nodes have `health: 1`.

---

### STEP 1: Demonstrating CONCEPT 1 — Data Replication
1. In `main.py`, select **Option 11** (`Test Data Replication`).
2. **What happens on screen**:
   - The program inserts a book through the Replica Set Primary (`localhost:27018`).
   - It directly queries Secondary Node 2 (`27019`) and Secondary Node 3 (`27020`) using direct connections.
   - A grid appears showing that the exact same book document exists on all three independent nodes with replication latency measured in milliseconds.
   - It performs an update and shows the updated value synchronized to all nodes.
3. **What to say to Mam**:
   > *"Mam, here we demonstrate Single-Master replication. When a client performs a write, it is committed to the Primary node's Write-Ahead Log called `local.oplog.rs` (Operations Log). The secondaries continuously pull this oplog asynchronously and replay the operations locally. As you can see in the table, the book record is replicated across all 3 physical nodes within a few milliseconds."*

---

### STEP 2: Demonstrating CONCEPT 2 — Fault Tolerance
1. In `main.py`, select **Option 12** -> choose **1** (`Simulate Secondary Node Crash`).
2. **What happens on screen**:
   - The script gracefully stops Secondary Node 3 (`port 27020`).
   - It immediately executes a book insert and a book search on the library database.
   - The operations succeed without error!
   - Node 3 is restarted and automatically rejoins the cluster, synchronizing missing data.
3. **What to say to Mam**:
   > *"Mam, this demonstrates Fault Tolerance. Even though Node 3 suffered a node crash, the library system experienced zero downtime. Because we have $N = 3$ nodes and 2 nodes remained healthy, the cluster still maintained a majority quorum ($2 > 3/2$), allowing continuous read and write operations."*

---

### STEP 3: Demonstrating CONCEPT 3 — High Availability & Automatic Failover
1. In `main.py`, select **Option 12** -> choose **2** (`Simulate Primary Crash & Automatic Failover`).
2. **What happens on screen**:
   - The script detects the active Primary (e.g. Node 1 on port 27018).
   - It shuts down Node 1 to simulate a catastrophic hardware crash.
   - It displays a live 1-second polling countdown monitoring the election.
   - Within 2 to 4 seconds, the surviving nodes (Node 2 and Node 3) detect missed heartbeats and hold a Raft-based election.
   - Node 2 is declared NEW PRIMARY!
   - The Python application reconnects via the replica set connection string and successfully writes a new library record to Node 2!
   - Node 1 is restarted and rejoins as a SECONDARY.
3. **What to say to Mam**:
   > *"Mam, in a centralized database, if the database server crashes, the entire system is down. In our distributed system, MongoDB uses a consensus election protocol. When the Primary crashes, heartbeats time out after 10 seconds, and the surviving secondaries vote. Node 2 receives a majority vote and becomes the new writable Primary. The client driver automatically discovers the new Primary without restarting the application."*

---

### STEP 4: Demonstrating CONCEPT 5 — Data Consistency
1. In `main.py`, select **Option 13** (`Demonstrate Consistency`).
2. **What happens on screen**:
   - A comparative benchmark runs comparing:
     - `w: 1` (Primary acknowledged only)
     - `w: "majority"` (Acknowledged only after written to majority of replica nodes)
   - Read visibility comparison between `readPreference=PRIMARY` (strict consistency) vs `readPreference=SECONDARY` (eventual consistency).
3. **What to say to Mam**:
   > *"Mam, this experiment demonstrates the CAP and PACELC theorems in distributed systems. With `w: 1`, writes are fast because only the Primary acknowledges the write, but there is a small risk of rollback if the Primary crashes before replicating. With `w: 'majority'`, the write is only acknowledged once committed to at least 2 nodes, giving strong consistency at the cost of slightly higher write latency."*

---

### STEP 5: Demonstrating CONCEPT 4 — Data Sharding
1. Start the sharded cluster:
   ```powershell
   .\scripts\start_sharded_cluster.bat
   .\scripts\init_sharded_cluster.bat
   ```
2. In `main.py`, press `m` to switch database mode -> select **2** (`Stage B: Sharded Cluster via mongos on port 27050`).
3. Select **Option 14** (`Display Sharding Status`).
4. **What happens on screen**:
   - Shows connection to `mongos` query router (port 27050).
   - Displays registered shards: `shard1-rs` (port 27200) and `shard2-rs` (port 27300).
   - Displays database `library_db` partitioned = True.
   - Displays collection `books` sharded on `{ category: 1, bookId: 1 }`.
   - Displays document counts and chunk distribution across Shard 1 and Shard 2.
5. **What to say to Mam**:
   > *"Mam, Stage B demonstrates Horizontal Partitioning (Sharding). Instead of storing all library books on one machine, the collection is horizontally partitioned across Shard 1 and Shard 2. The Config Server on port 27100 tracks chunk ranges, and the `mongos` router on port 27050 serves as the single query entry point for clients."*

---

### STEP 6: Demonstrating CONCEPT 6 — Distributed Query Processing
1. In `main.py`, select **Option 15** (`Run Distributed Query Experiment`).
2. **What happens on screen**:
   - **Case 1: Targeted Query**: Query filters by Shard Key `{"category": "Computer Science"}`.
     - `explain()` output shows `SINGLE_SHARD` routing. mongos routes the query directly to ONLY the shard holding that category range.
   - **Case 2: Scatter-Gather Query**: Query filters by non-shard key `{"author": "Martin Kleppmann"}`.
     - `explain()` output shows `SHARD_MERGE` broadcast. mongos sends the query to ALL shards in parallel and merges partial result streams.
3. **What to say to Mam**:
   > *"Mam, this demonstrates distributed query execution plans. When a query includes the shard key, the router does a targeted route to exactly one shard, preventing wasted network I/O. When a query omits the shard key, the router must broadcast a scatter-gather query to every shard and merge results, which increases network overhead."*

---

### STEP 7: Demonstrating CONCEPT 7 — Performance & Scalability Benchmark
1. In `main.py`, select **Option 16** (`Run Performance Comparison`).
2. **What happens on screen**:
   - Generates 1,000 synthetic library book records.
   - Measures insertion time, throughput (records/sec), and read query latency across:
     - Standalone Node (`localhost:27017`)
     - 3-Node Replica Set (`rs0`)
     - Sharded Cluster (`mongos 27050`)
   - Prints a formatted comparison table and exports the numbers to `experiments/benchmark_run_results.csv`.
3. **What to say to Mam**:
   > *"Mam, here we analyze empirical throughput and latency. On a single laptop, standalone writes have lower latency because all processes share the same physical SSD and CPU, without network coordination. However, in production, sharding enables horizontal storage scalability beyond the RAM and disk limits of any single server, while replication provides high availability."*

---

## 3. Top 5 Questions Mam Might Ask & Winning Answers

1. **Mam asks:** *"Why does MongoDB replica set need an odd number of voting nodes like 3?"*
   - **Your Answer:** *"Because distributed consensus requires a strict majority quorum $(N/2 + 1)$. With 3 nodes, majority is 2. If one node fails, the remaining 2 can still form a majority and elect a primary. An even number like 2 nodes would result in a split-brain tie (1 vs 1) where no node can reach majority."*

2. **Mam asks:** *"What is the difference between mongod and mongos?"*
   - **Your Answer:** *"mongod is the database daemon process that actually stores physical data and indexes on disk. mongos is a stateless query router that sits between client applications and the sharded cluster; it does not store data, but routes queries to the correct shards based on metadata from the Config Server."*

3. **Mam asks:** *"What is the Shard Key you chose, and why?"*
   - **Your Answer:** *"We chose a compound shard key `{ category: 1, bookId: 1 }`. Category provides logical domain partitioning by academic discipline, and bookId provides high cardinality and uniqueness, preventing jumbo chunks."*

4. **Mam asks:** *"What is the difference between `w: 1` and `w: 'majority'`?"*
   - **Your Answer:** *"With `w: 1`, the Primary sends acknowledgment to the client as soon as the write is written to its own memory and oplog, before secondaries receive it. With `w: 'majority'`, the Primary waits until at least $\lfloor N/2 \rfloor + 1$ members have acknowledged the write in their oplogs, guaranteeing persistence even if the current primary crashes immediately after."*

5. **Mam asks:** *"How did you prevent negative available book copies when multiple users borrow simultaneously?"*
   - **Your Answer:** *"In `library_operations.py`, we used MongoDB's atomic `find_one_and_update()` with a condition `availableCopies: {'$gt': 0}` and atomic `$inc: {'availableCopies': -1}`. Because MongoDB guarantees document-level atomicity, two concurrent requests can never over-decrement availability into negative numbers."*
