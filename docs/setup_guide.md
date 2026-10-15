# SETUP AND EXECUTION GUIDE
## Implementation of Distributed Databases Using MongoDB: A Library Management System

---

## 1. Environment & Prerequisites

- **Operating System:** Windows 10 / 11 (64-bit)
- **MongoDB Community Server:** Version 8.x (Installed at `C:\Program Files\MongoDB\Server\8.2\bin\`)
- **MongoDB Shell (`mongosh`):** Version 2.3+ (Installed in user programs or PATH)
- **Python:** Python 3.12+ (64-bit)
- **Python Libraries:** `pymongo`, `tabulate`, `dnspython`

All dependencies and executables have been pre-installed and configured on your machine.

---

## 2. Directory Layout
The project resides at:
`C:\Users\HP\Desktop\Distributed system\`

```
Distributed system/
├── app/
│   ├── database.py             # Cluster connection manager & schema validator
│   ├── library_operations.py   # Concurrency-safe library operations
│   └── main.py                 # 17-option CLI menu application
├── replication/
│   ├── setup_replica_set.js    # rs0 initiation script for mongosh
│   ├── replication_test.py     # Concept 1: Data replication & lag benchmark
│   ├── failover_test.py        # Concepts 2 & 3: Fault tolerance & leader election
│   └── consistency_test.py     # Concept 5: Write concern & read preference
├── sharding/
│   ├── setup_sharded_cluster.js# Shard registration and collection sharding
│   ├── sharding_test.py        # Concept 4: Chunk distribution & shard verification
│   └── distributed_query_test.py# Concept 6: Targeted vs Scatter-Gather queries
├── experiments/
│   ├── generate_dataset.py     # Reproducible synthetic generator (1,000+ books)
│   ├── performance_test.py     # Concept 7: Throughput & latency benchmark
│   ├── results_template.csv    # Benchmark template CSV
│   └── benchmark_run_results.csv# Live measured results
├── scripts/
│   ├── start_replica_set.bat   # Starts 3 replica nodes (ports 27018, 27019, 27020)
│   ├── init_replica_set.bat    # Initiates replica set rs0
│   ├── stop_replica_set.bat    # Gracefully stops replica set nodes
│   ├── start_sharded_cluster.bat# Starts config and shard nodes (27100, 27200, 27300)
│   ├── init_sharded_cluster.bat # Initiates config/shard RS and starts mongos (27050)
│   └── stop_sharded_cluster.bat # Gracefully stops sharded cluster
├── docs/
│   ├── architecture_diagrams.md# Detailed ASCII & Mermaid architecture diagrams
│   ├── setup_guide.md          # This installation and setup guide
│   ├── project_report.md       # Comprehensive academic project report
│   ├── viva_questions.md       # 20 Viva questions with in-depth answers
│   └── teacher_demo_script.md  # Step-by-step presentation script for teachers
├── run_app.bat                 # One-click application launcher
├── requirements.txt            # Python package requirements
└── README.md                   # Project overview and quickstart
```

---

## 3. How to Run Stage A: Replica Set

### Step A.1: Start the 3 Replica Set Nodes
Double-click `scripts\start_replica_set.bat` OR open PowerShell and run:
```powershell
cd "C:\Users\HP\Desktop\Distributed system"
.\scripts\start_replica_set.ps1
```
This spawns 3 background MongoDB instances:
- Node 1: Port `27018` (Data: `data\replica\node1`)
- Node 2: Port `27019` (Data: `data\replica\node2`)
- Node 3: Port `27020` (Data: `data\replica\node3`)

### Step A.2: Initiate the Replica Set
Double-click `scripts\init_replica_set.bat` OR run:
```powershell
.\scripts\init_replica_set.ps1
```
This executes `replSetInitiate` and elects a Primary.

### Step A.3: Launch the Python Application
Double-click `run_app.bat` OR run:
```powershell
python app\main.py
```
From the menu, choose:
- `1` to `9`: Library operations (Add Book, Issue Book, Return Book, etc.).
- `10`: Display Replica Set Status.
- `11`: Test Data Replication.
- `12`: Simulate Node Failure and Automatic Failover.
- `13`: Test Consistency (w:1 vs w:majority).

---

## 4. How to Run Stage B: Sharded Cluster

### Step B.1: Start Sharded Cluster Nodes
Double-click `scripts\start_sharded_cluster.bat` OR run:
```powershell
.\scripts\start_sharded_cluster.ps1
```
This starts:
- Config Server: Port `27100` (`cfg-rs`)
- Shard 1 Node: Port `27200` (`shard1-rs`)
- Shard 2 Node: Port `27300` (`shard2-rs`)

### Step B.2: Initialize and Start Query Router (`mongos`)
Double-click `scripts\init_sharded_cluster.bat` OR run:
```powershell
.\scripts\init_sharded_cluster.ps1
```
This initiates replica sets, launches `mongos` on port `27050`, registers both shards, enables sharding for `library_db`, and shards collection `books` on `{ category: 1, bookId: 1 }`.

### Step B.3: Test Sharded Operations in the Application
In `main.py`:
- Press `m` and select `2` (Switch to Sharded Cluster).
- Choose `14`: Display Sharding Status.
- Choose `15`: Run Distributed Query Experiment (Targeted vs Scatter-Gather).
- Choose `16`: Run Performance Comparison.

---

## 5. How to Stop All Processes Gracefully

When you are finished testing:
- To stop the Replica Set: Double-click `scripts\stop_replica_set.bat`.
- To stop the Sharded Cluster: Double-click `scripts\stop_sharded_cluster.bat`.

Both scripts send the graceful MongoDB administrative command `{ shutdown: 1 }` to prevent database corruption.
