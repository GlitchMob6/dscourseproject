# DISTRIBUTED DATABASE ARCHITECTURE DIAGRAMS
## Implementation of Distributed Databases Using MongoDB: A Library Management System

---

## 1. Overall System Architecture

```mermaid
flowchart TD
    Client["Python CLI Application (app/main.py)"]
    
    subgraph StageA["STAGE A: 3-Node Replica Set (rs0)"]
        direction TB
        Node1["Node 1 (Port 27018)\n[PRIMARY]\nAccepts Writes & Reads"]
        Node2["Node 2 (Port 27019)\n[SECONDARY]\nOplog Replication"]
        Node3["Node 3 (Port 27020)\n[SECONDARY]\nOplog Replication"]
        
        Node1 -- "Oplog Stream" --> Node2
        Node1 -- "Oplog Stream" --> Node3
        Node1 <-->|Heartbeats (2s)| Node2
        Node2 <-->|Heartbeats (2s)| Node3
        Node1 <-->|Heartbeats (2s)| Node3
    end

    subgraph StageB["STAGE B: Production Sharded Cluster"]
        direction TB
        Router["mongos Query Router\n(Port 27050)"]
        Config["Config Server (cfg-rs)\n(Port 27100)\nStores Metadata & Chunks"]
        
        Shard1["Shard 1 (shard1-rs)\n(Port 27200)\nBooks: Computer Science, IT, Math"]
        Shard2["Shard 2 (shard2-rs)\n(Port 27300)\nBooks: Electrical, Mechanical, Physics"]
        
        Router <-->|Fetch Chunk Routing Table| Config
        Router -->|Targeted / Broadcast Queries| Shard1
        Router -->|Targeted / Broadcast Queries| Shard2
    end

    Client -.->|Default Connection (Stage A)| Node1
    Client -.->|Connection Mode Switch (Stage B)| Router
```

---

## 2. Stage A: Replica Set Fault Tolerance & Failover Mechanics

```mermaid
sequenceDiagram
    autonumber
    participant App as Python Application
    participant P as Node 1 (Primary : 27018)
    participant S1 as Node 2 (Secondary : 27019)
    participant S2 as Node 3 (Secondary : 27020)

    Note over P,S2: Normal Operation
    App->>P: Write: insertOne(bookId: "BK-101")
    P-->>P: Commit to WiredTiger & local.oplog.rs
    P-->>App: Write Acknowledged (w: 1)
    P-->>S1: Async Oplog Sync
    P-->>S2: Async Oplog Sync

    Note over P: Failure Event (Node 1 Crashes)
    P-xP: Power Loss / Process Terminated
    S1-xP: Missed Heartbeats (>10s electionTimeout)
    S2-xP: Missed Heartbeats (>10s electionTimeout)

    Note over S1,S2: Consensus Quorum Election (Raft / Paxos)
    S1->>S2: RequestVotes(Term: 2)
    S2-->>S1: VoteGranted (Majority 2/3 achieved!)
    Note over S1: S1 promotes to NEW PRIMARY

    App->>S1: Driver reconnects & issues writes to S1
    S1-->>App: Write Accepted on Node 2!
```

---

## 3. Stage B: Distributed Query Processing Architecture

### Scenario 1: Targeted Query Routing (High Efficiency)
When the filter contains the Shard Key prefix (`category`):

```mermaid
flowchart LR
    App["Application Find Request:\n{ category: 'Computer Science' }"] --> Router["mongos Router\n(Port 27050)"]
    Router -->|1. Lookup Chunk Map| Cache["Cached Metadata:\n'Computer Science' -> Shard 1"]
    Router -->|2. Direct TCP Routing| Shard1["Shard 1 (Port 27200)\n[SINGLE_SHARD Execution]"]
    Shard1 -->|3. Return matching records| Router
    Router -->|4. Return final documents| App
```

### Scenario 2: Scatter-Gather Broadcast Routing
When the filter searches on a non-shard key (`author` or `title`):

```mermaid
flowchart TD
    App["Application Find Request:\n{ author: 'Martin Kleppmann' }"] --> Router["mongos Router\n(Port 27050)"]
    Router -->|Broadcast in parallel| Shard1["Shard 1 (Port 27200)\nExecutes Local Scan"]
    Router -->|Broadcast in parallel| Shard2["Shard 2 (Port 27300)\nExecutes Local Scan"]
    Shard1 -->|Partial Results Batch 1| Router
    Shard2 -->|Partial Results Batch 2| Router
    Router --> Merge["SHARD_MERGE Stage\nIn-Memory Collation & Sorting"]
    Merge --> App
```

---

## 4. Shard Chunk Range Boundary Distribution

```
Collection: library_db.books
Compound Shard Key: { category: 1, bookId: 1 }

        Chunk 1 Range                      Chunk 2 Range                      Chunk 3 Range
[MinKey -> ("Computer Science", "BK-500")]  [("Computer Science", "BK-500") -> ("Math", MaxKey)]  [("Math", MaxKey) -> MaxKey]
                   │                                         │                                      │
                   ▼                                         ▼                                      ▼
             Stored on SHARD 1                         Stored on SHARD 1                      Stored on SHARD 2
             (Port 27200)                              (Port 27200)                           (Port 27300)
```
