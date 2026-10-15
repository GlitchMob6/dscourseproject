# Implementation of Distributed Databases Using MongoDB: A Library Management System

[![Python 3.12](https://img.shields.io/badge/Python-3.12%2B-blue.svg)](https://www.python.org/)
[![MongoDB 8.2](https://img.shields.io/badge/MongoDB-Community%208.2-green.svg)](https://www.mongodb.com/)
[![PyMongo Driver](https://img.shields.io/badge/Driver-PyMongo%204.18-brightgreen.svg)](https://pymongo.readthedocs.io/)
[![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-lightgrey.svg)](https://microsoft.com)
[![Course](https://img.shields.io/badge/Course-Distributed%20Systems-orange.svg)]()

> **Academic Course Project**: Bachelor of Engineering in Computer Science & Engineering  
> **Topic**: Distributed Data Storage, Replication, Quorum Consensus, Fault Tolerance, Partitioning (Sharding), Distributed Query Processing, and Horizontal Scalability.

---

## 1. Project Overview

This project implements a complete, runnable, command-line **Library Management System** built on top of a multi-node distributed database architecture using **MongoDB Community Server** and **Python (PyMongo)**. 

Rather than focusing on web styling or front-end frameworks, this project is engineered from first principles to explore, demonstrate, and empirically measure the fundamental theoretical and practical concepts of **Distributed Systems**:

1. **Stage A (3-Node Replica Set `rs0`)**: Demonstrates master-slave replication, asynchronous oplog streaming, Raft-based majority election consensus, and zero-downtime automatic failover.
2. **Stage B (Horizontal Sharded Cluster)**: Demonstrates horizontal data partitioning (sharding), chunk range boundary tracking via Config Servers, and distributed query processing (Targeted vs. Scatter-Gather routing) through the `mongos` query router.
3. **Stage C (Modern Graphical UI & FastAPI Layer)**: Provides a dark-themed visual command center for live cluster monitoring, atomic book circulation, and interactive visual distributed experiments (Recharts latency graphs, timeline execution, and topology probes).

---

## 1.1 Modern Graphical Web UI Layer

A modern, high-performance web interface has been built on top of the backend:

- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS, Lucide Icons, and Recharts.
- **Backend API**: FastAPI wrapping `DatabaseManager`, `LibraryService`, and all distributed test runners directly without duplicating business logic.

### Quick Start UI
Double-click `start_ui.bat` in the project root, or execute:
```powershell
.\start_ui.bat
```
*(Or in PowerShell: `.\start_ui.ps1`)*

### Manual Startup
1. **Start the FastAPI Backend**:
   ```bash
   python -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
   ```
   *(Interactive Swagger API documentation available at `http://127.0.0.1:8000/docs`)*

2. **Start the React Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```
   Open `http://localhost:5173` in your browser.

---

## 2. Distributed Database Architecture

### Overall System Architecture Diagram

```mermaid
flowchart TD
    Client["Python CLI Application (app/main.py)\nMenu-driven Interactive Console"]
    
    subgraph StageA["STAGE A: 3-Node High-Availability Replica Set (rs0)"]
        direction TB
        Node1["Node 1 (Port 27018)\n[PRIMARY]\nAccepts Client Writes & Reads\nWrites to local.oplog.rs"]
        Node2["Node 2 (Port 27019)\n[SECONDARY]\nContinuously syncs oplog\nVotes in elections"]
        Node3["Node 3 (Port 27020)\n[SECONDARY]\nContinuously syncs oplog\nVotes in elections"]
        
        Node1 == "Asynchronous Oplog Stream" ==> Node2
        Node1 == "Asynchronous Oplog Stream" ==> Node3
        Node1 <-->|Heartbeats (2000 ms)| Node2
        Node2 <-->|Heartbeats (2000 ms)| Node3
        Node1 <-->|Heartbeats (2000 ms)| Node3
    end

    subgraph StageB["STAGE B: Production Sharded Cluster Deployment"]
        direction TB
        Router["mongos Query Router\n(Port 27050)\nStateless Query Coordinator"]
        Config["Config Server (cfg-rs)\n(Port 27100)\nStores Metadata & Chunk Mappings"]
        
        Shard1["Shard 1 (shard1-rs)\n(Port 27200)\nStorage for Chunk Ranges (e.g. CS, IT, Math)"]
        Shard2["Shard 2 (shard2-rs)\n(Port 27300)\nStorage for Chunk Ranges (e.g. EE, ME, Phys)"]
        
        Router <-->|Fetch Chunk Routing Cache| Config
        Router -->|Single-Shard Targeted Query| Shard1
        Router -->|Scatter-Gather Broadcast| Shard2
    end

    Client -.->|Default Mode: Replica Set| Node1
    Client -.->|Switched Mode 'm': Sharded Cluster| Router
```

---

## 3. Technology Stack & System Requirements

- **Programming Language:** Python 3.12 (64-bit)
- **Database Engine:** MongoDB Community Server 8.2 (Installed at `C:\Program Files\MongoDB\Server\8.2\bin\`)
- **Interactive Shell:** MongoDB Shell (`mongosh`) 2.3+
- **Python Database Driver:** `pymongo>=4.6.0`, `dnspython>=2.9.0`
- **CLI Table Formatter:** `tabulate>=0.9.0`
- **Host Operating System:** Microsoft Windows 10 / 11 (64-bit)
- **Deployment Topology:** Isolated background MongoDB processes on distinct TCP ports and physical disk folders on one computer.

---

## 4. Project Directory Structure

```
Distributed system/
├── app/
│   ├── database.py             # Connection manager, failover client & schema initializer
│   ├── library_operations.py   # Atomic, concurrency-safe library business logic
│   └── main.py                 # 17-option interactive command-line interface
├── replication/
│   ├── setup_replica_set.js    # Replica set rs0 initiation script for mongosh
│   ├── replication_test.py     # Concept 1: Primary-to-secondary sync benchmark
│   ├── failover_test.py        # Concepts 2 & 3: Fault tolerance & leader election
│   └── consistency_test.py     # Concept 5: Write concerns & read preference analysis
├── sharding/
│   ├── setup_sharded_cluster.js# Shard registration and collection sharding for mongosh
│   ├── sharding_test.py        # Concept 4: Chunk boundary and shard balance inspector
│   └── distributed_query_test.py# Concept 6: Targeted routing vs. Scatter-Gather execution plans
├── experiments/
│   ├── generate_dataset.py     # Reproducible synthetic generator (1,000+ library books)
│   ├── performance_test.py     # Concept 7: Throughput & latency benchmarking suite
│   ├── results_template.csv    # Benchmark metric recording template
│   └── benchmark_run_results.csv# Live measured latency and throughput CSV
├── scripts/
│   ├── start_replica_set.py    # Python background launcher for Stage A nodes
│   ├── start_replica_set.bat   # Windows one-click launcher for Stage A nodes
│   ├── start_replica_set.ps1   # PowerShell launcher for Stage A nodes
│   ├── init_replica_set.py     # Automatic Python initiator for replica set rs0
│   ├── init_replica_set.bat    # Windows one-click initiator for replica set rs0
│   ├── init_replica_set.ps1    # PowerShell initiator for replica set rs0
│   ├── stop_nodes.py           # Safe MongoDB administrative shutdown script
│   ├── stop_replica_set.bat    # Windows graceful shutdown for replica set nodes
│   ├── stop_replica_set.ps1    # PowerShell graceful shutdown for replica set nodes
│   ├── start_sharded_cluster.py# Python launcher for Stage B storage nodes
│   ├── start_sharded_cluster.bat# Windows one-click launcher for Stage B nodes
│   ├── start_sharded_cluster.ps1# PowerShell launcher for Stage B nodes
│   ├── init_sharded_cluster.py # Automated configurator for sharded cluster & mongos
│   ├── init_sharded_cluster.bat# Windows one-click initiator for Stage B cluster
│   ├── init_sharded_cluster.ps1# PowerShell initiator for Stage B cluster
│   ├── stop_sharded_cluster.bat# Windows graceful shutdown for Stage B cluster
│   └── stop_sharded_cluster.ps1# PowerShell graceful shutdown for Stage B cluster
├── docs/
│   ├── architecture_diagrams.md# Complete Mermaid and ASCII architecture diagrams
│   ├── setup_guide.md          # Step-by-step installation and execution guide
│   ├── project_report.md       # Full 16-section college-level academic project report
│   ├── viva_questions.md       # 20 Comprehensive Viva questions and detailed answers
│   └── teacher_demo_script.md  # Scripted presentation walkthrough for examiners
├── requirements.txt            # Python dependencies
├── run_app.bat                 # One-click application launcher
└── README.md                   # This project documentation
```

---

## 5. Step-by-Step Installation & Execution Guide

### Prerequisites Verification
Ensure MongoDB Community Server and Python are installed:
```powershell
mongod --version
python --version
```
Install Python dependencies:
```powershell
pip install -r requirements.txt
```

---

### Phase 1: Running Stage A (Replica Set)

#### 1. Start the 3 Replica Set Members
Double-click `scripts\start_replica_set.bat` OR run in PowerShell:
```powershell
python scripts\start_replica_set.py
```
This spawns 3 isolated background MongoDB nodes:
- **Node 1:** Port `27018` (Data: `data\replica\node1`)
- **Node 2:** Port `27019` (Data: `data\replica\node2`)
- **Node 3:** Port `27020` (Data: `data\replica\node3`)

#### 2. Initiate the Replica Set
Double-click `scripts\init_replica_set.bat` OR run:
```powershell
python scripts\init_replica_set.py
```
This sends the `replSetInitiate` command, establishes consensus, and elects Node 1 as the initial Primary.

#### 3. Launch the Application
Double-click `run_app.bat` OR run:
```powershell
python app\main.py
```

---

### Phase 2: Running Stage B (Sharded Cluster)

#### 1. Start Sharded Cluster Storage Nodes
Double-click `scripts\start_sharded_cluster.bat` OR run:
```powershell
python scripts\start_sharded_cluster.py
```
This starts:
- **Config Server (`cfg-rs`):** Port `27100` (Data: `data\sharding\config1`)
- **Shard 1 (`shard1-rs`):** Port `27200` (Data: `data\sharding\shard1`)
- **Shard 2 (`shard2-rs`):** Port `27300` (Data: `data\sharding\shard2`)

#### 2. Initialize Sharding & Launch Query Router (`mongos`)
Double-click `scripts\init_sharded_cluster.bat` OR run:
```powershell
python scripts\init_sharded_cluster.py
```
This initiates the replica sets, starts `mongos` on port `27050`, registers `shard1-rs` and `shard2-rs`, enables sharding for `library_db`, and shards `library_db.books` on `{ category: 1, bookId: 1 }`.

#### 3. Connect Application to Sharded Cluster
In `main.py`, enter `m` and select **Option 2** (`Stage B: Sharded Cluster via mongos on port 27050`).

---

### Phase 3: Graceful Shutdown
To cleanly shut down database processes without risking database corruption:
- For Replica Set: Double-click `scripts\stop_replica_set.bat` (or `python scripts\stop_nodes.py 27018 27019 27020`).
- For Sharded Cluster: Double-click `scripts\stop_sharded_cluster.bat` (or `python scripts\stop_nodes.py 27050 27200 27300 27100`).

---

## 6. The Seven Distributed Systems Concepts Implemented

### Concept 1: Data Replication (Primary-to-Secondary Sync)
- **Implementation:** [`replication/replication_test.py`](file:///c:/Users/HP/Desktop/Distributed%20system/replication/replication_test.py) (Menu Option 11)
- **Mechanism:** Writes are accepted by the Primary on port 27018 and recorded into the circular append-only `local.oplog.rs` collection. Secondaries on ports 27019 and 27020 continuously tail this log asynchronously and replay the operations locally.
- **Verification:** The script inserts, updates, and deletes test books, establishing direct TCP socket queries to each secondary to measure replication propagation latency (typically < 10 ms).

### Concept 2: Fault Tolerance
- **Implementation:** [`replication/failover_test.py`](file:///c:/Users/HP/Desktop/Distributed%20system/replication/failover_test.py) (Menu Option 12 -> 1)
- **Mechanism:** Simulates a crash of Secondary Node 3 (`port 27020`). Because 2 out of 3 nodes survive, the majority quorum requirement ($\lfloor 3/2 \rfloor + 1 = 2$) is satisfied.
- **Verification:** The application continues performing writes and reads with zero errors. Upon restarting Node 3, it catches up with missed transactions automatically.

### Concept 3: High Availability and Automatic Primary Election
- **Implementation:** [`replication/failover_test.py`](file:///c:/Users/HP/Desktop/Distributed%20system/replication/failover_test.py) (Menu Option 12 -> 2)
- **Mechanism:** Simulates an unexpected failure of the active Primary node. Heartbeat timeouts (> 10,000 ms) trigger a Raft-based consensus election among surviving nodes. Node 2 receives majority votes and is promoted to Primary.
- **Verification:** Live polling monitors the election transition. The PyMongo client driver automatically re-routes new writes to the new Primary without restarting the application.

### Concept 4: Data Sharding (Horizontal Partitioning)
- **Implementation:** [`sharding/sharding_test.py`](file:///c:/Users/HP/Desktop/Distributed%20system/sharding/sharding_test.py) (Menu Option 14)
- **Mechanism:** Partitions `library_db.books` across two distinct physical shards (`shard1-rs` and `shard2-rs`) using the compound shard key `{ category: 1, bookId: 1 }`.
- **Verification:** Inspects `listShards`, `config.databases`, `config.collections`, and collection statistics to verify chunk counts and physical document distributions across both shards.

### Concept 5: Data Consistency (CAP & PACELC Trade-offs)
- **Implementation:** [`replication/consistency_test.py`](file:///c:/Users/HP/Desktop/Distributed%20system/replication/consistency_test.py) (Menu Option 13)
- **Mechanism:** Evaluates write durability and read visibility trade-offs:
  - Write Concerns: `w: 1` (Primary memory acknowledged, fast) vs. `w: "majority"` (Quorum acknowledged, safe against failover rollback).
  - Read Preferences: `PRIMARY` (Linearizable strict consistency) vs. `SECONDARY` (Eventual consistency with possible replication lag).
- **Verification:** Measures and prints latency differences across 20 iterations.

### Concept 6: Distributed Query Processing
- **Implementation:** [`sharding/distributed_query_test.py`](file:///c:/Users/HP/Desktop/Distributed%20system/sharding/distributed_query_test.py) (Menu Option 15)
- **Mechanism:** Connects through `mongos` (port 27050) and analyzes execution plans using `explain()`:
  - **Case 1: Targeted Query:** Filtering on the shard key (`{"category": "Computer Science"}`) results in `SINGLE_SHARD` routing (mongos contacts only the specific shard holding that chunk).
  - **Case 2: Scatter-Gather Query:** Filtering on a non-shard key (`{"author": "Martin Kleppmann"}`) requires broadcasting the query in parallel to ALL shards and performing an in-memory `SHARD_MERGE`.

### Concept 7: Horizontal Scalability & Performance Benchmarking
- **Implementation:** [`experiments/performance_test.py`](file:///c:/Users/HP/Desktop/Distributed%20system/experiments/performance_test.py) (Menu Option 16)
- **Mechanism:** Generates a deterministic dataset of 1,000 synthetic library books using [`experiments/generate_dataset.py`](file:///c:/Users/HP/Desktop/Distributed%20system/experiments/generate_dataset.py) and benchmarks bulk insertion time, point read latency, and range read latency across:
  1. Standalone MongoDB (`localhost:27017`)
  2. 3-Node Replica Set (`rs0`)
  3. Sharded Cluster (`mongos 27050`)
- **Verification:** Outputs a comparison table and exports empirical results to `experiments/benchmark_run_results.csv`.

---

## 7. Interactive Command-Line Menu Guide

When you launch `main.py`, the following 17-option interface is displayed:

```
==============================================================================
      IMPLEMENTATION OF DISTRIBUTED DATABASES USING MONGODB
                 LIBRARY MANAGEMENT SYSTEM (CLI)
==============================================================================
 [Cluster Mode]: REPLICA_SET   | [Set Name]: rs0        | [Active Primary]: 127.0.0.1:27018
==============================================================================

 --- [LIBRARY OPERATIONS] -----------------------------------------------------
  1. Add Book
  2. View All Books
  3. Search Book (by ID, Title, Author, or Category)
  4. Update Book
  5. Delete Book
  6. Register / View Members
  7. Issue Book (Atomic concurrency-safe availability decrement)
  8. Return Book (Atomic return & availability restore)
  9. View Borrowing History & Availability

 --- [DISTRIBUTED SYSTEMS EXPERIMENTS & DIAGNOSTICS] --------------------------
 10. Display Replica Set Status (rs.status() & Health)
 11. Test Data Replication (Concept 1: Primary-to-Secondary Sync)
 12. Simulate Node Failure & Recovery (Concepts 2 & 3: Fault Tolerance & Election)
 13. Demonstrate Consistency (Concept 5: Write Concern & Read Preferences)
 14. Display Sharding Status (Concept 4: Horizontal Chunk Distribution)
 15. Run Distributed Query Experiment (Concept 6: Targeted vs Scatter-Gather)
 16. Run Performance Comparison (Concept 7: Standalone vs Sharded Benchmark)
 17. Exit

Enter choice (1-17) [or 'm' to switch DB mode]:
```

---

## 8. Empirical Benchmark Results

Measured on Windows 11 with MongoDB Community Server 8.2 (1,000 synthetic records):

| Architecture | Dataset Size | Insert Time (s) | Throughput (docs/s) | Point Read (ms) | Range Read (ms) | Fault Tolerance |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Standalone (27017)** | 1,000 | 0.182 s | 5,494.5 | 0.42 ms | 1.15 ms | 0 Node Failures (SPOF) |
| **Replica Set (`rs0`)** | 1,000 | 0.345 s | 2,898.5 | 0.65 ms | 1.82 ms | 1 of 3 Node Failures |
| **Sharded Cluster (`mongos`)**| 1,000 | 0.710 s | 1,408.4 | 1.85 ms | 3.42 ms | 1 node per Shard RS |

> **Distributed Systems Observation:** On a single computer, standalone writes have lower latency because all processes share the same physical NVMe SSD and CPU cores without TCP network hops or replication consensus. In real data center deployments across separate physical servers, sharding delivers linear scaling beyond the RAM and disk limits of any single server machine.

---

## 9. Academic Documentation Files

This project includes complete documentation for academic evaluation and submissions:

1. **[docs/project_report.md](file:///c:/Users/HP/Desktop/Distributed%20system/docs/project_report.md):** Full 16-section college project report covering abstract, problem statement, architecture diagrams, PACELC theorem, experimental methodology, results, limitations, and references.
2. **[docs/viva_questions.md](file:///c:/Users/HP/Desktop/Distributed%20system/docs/viva_questions.md):** 20 comprehensive viva voce questions with in-depth technical answers covering CAP theorem, split-brain scenarios, WiredTiger MVCC, oplog replication, and shard keys.
3. **[docs/teacher_demo_script.md](file:///c:/Users/HP/Desktop/Distributed%20system/docs/teacher_demo_script.md):** Step-by-step presentation script designed for examiners, including recommended split-screen layout, exact clicks, and verbal explanations.
4. **[docs/architecture_diagrams.md](file:///c:/Users/HP/Desktop/Distributed%20system/docs/architecture_diagrams.md):** Complete sequence diagrams and chunk boundary maps in Mermaid format.
5. **[docs/setup_guide.md](file:///c:/Users/HP/Desktop/Distributed%20system/docs/setup_guide.md):** Quick-reference setup and troubleshooting guide.

---

## 10. Authors & Acknowledgments

- **Subject:** Distributed Systems (CS601 / CS701)
- **Department:** Computer Science & Engineering
- **Academic Year:** 2026–2027
