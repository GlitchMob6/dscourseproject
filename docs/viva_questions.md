# COMPREHENSIVE VIVA QUESTIONS & ANSWERS (DISTRIBUTED SYSTEMS)
## Implementation of Distributed Databases Using MongoDB: A Library Management System

---

### Q1: What is a Distributed Database, and how does it differ from a Centralized Database?
**Answer:**  
A distributed database is a collection of multiple logically interrelated databases distributed across different physical or virtual nodes interconnected by a network. Unlike a centralized database where all processing, storage, and I/O occur on a single physical server (creating a single point of failure and vertical scaling bottleneck), a distributed database partitions and replicates data across multiple nodes to achieve high availability, fault tolerance, and horizontal scalability.

---

### Q2: How does MongoDB relate to the CAP Theorem?
**Answer:**  
Eric Brewer's CAP Theorem states that a distributed data store can guarantee at most two of three properties simultaneously: Consistency (C), Availability (A), and Partition Tolerance (P).
Since network partitions are inevitable in real-world distributed networks, systems must choose between CP and AP:
- By default, MongoDB operates as a **CP system**. During a network partition, if a node cannot reach the majority quorum, it refuses writes to protect consistency against split-brain divergence.
- However, MongoDB offers tunable consistency: by setting `readPreference=secondary`, it can deliver AP behavior for read workloads.

---

### Q3: What is the PACELC Theorem, and how does it explain MongoDB's Write Concerns?
**Answer:**  
Daniel Abadi's PACELC theorem extends CAP: **If there is a Partition (P), trade Availability (A) vs Consistency (C); Else (E), trade Latency (L) vs Consistency (C).**
- When the cluster is healthy (Else), MongoDB allows tuning Latency vs Consistency:
  - `w: 1`: Lower latency (Fast), acknowledges write as soon as written to Primary's local memory/oplog.
  - `w: "majority"`: Higher latency, waits until committed to a quorum of nodes, ensuring zero rollback on sudden primary failover.

---

### Q4: Explain the replication mechanism in MongoDB. What is the role of the `oplog`?
**Answer:**  
MongoDB uses **Single-Master (Primary-Secondary) replication**. All write operations must be submitted to the Primary node. The Primary logs every state modification into a capped collection called `local.oplog.rs` (Operations Log). Secondary nodes continuously tail this oplog asynchronously (or synchronously depending on write concern) and apply the idempotent transformations locally to keep their datasets identical.

---

### Q5: What is Majority Quorum, and why is an odd number of nodes (e.g., 3) recommended?
**Answer:**  
To elect a Primary or commit a majority write, a candidate must receive votes from a strict majority:
$$\text{Quorum} = \lfloor N / 2 \rfloor + 1$$
- For $N = 3$ nodes, majority is $\lfloor 3/2 \rfloor + 1 = 2$. If 1 node fails, 2 survive, so the cluster remains fully operational.
- With an even number (e.g., 2 nodes), majority is 2. If 1 node fails, the survivor has only 1 vote ($1 < 2$) and cannot elect a primary. Having 3 nodes provides the same fault tolerance as 4 nodes with less hardware cost and prevents split-brain ties.

---

### Q6: What is a Split-Brain scenario, and how does MongoDB prevent it?
**Answer:**  
A split-brain occurs when a network partition separates a cluster into two disconnected partitions, and both partitions attempt to elect a Primary and accept client writes concurrently, leading to irreconcilable data conflicts.
MongoDB prevents this strictly via majority quorum: in any partition, only the subset containing more than $50\%$ of the configured voting members can elect a Primary. The minority partition demotes its node to Secondary.

---

### Q7: Explain the difference between `mongod` and `mongos`.
**Answer:**  
- `mongod` is the core database daemon process. It manages data files on disk, executes local read/write queries, runs background indexers, and handles replica set consensus.
- `mongos` is the stateless Query Router for sharded clusters. It does not store application data; instead, it acts as an interface that routes client queries to the appropriate shard(s) based on cluster metadata cached from the Config Servers.

---

### Q8: What are the primary components of a MongoDB Sharded Cluster?
**Answer:**  
1. **Shards:** Physical nodes/replica sets that store the actual chunk subsets of the sharded collections.
2. **Config Servers:** A dedicated replica set that stores cluster metadata, chunk range boundaries, and shard locations.
3. **Query Routers (`mongos`):** Stateless routers that intercept client requests, consult chunk mappings, and route operations to the correct shards.

---

### Q9: What is a Shard Key, and what criteria determine a good Shard Key?
**Answer:**  
A shard key is an indexed field or compound fields that MongoDB uses to distribute documents across shards.
Good Shard Key criteria:
1. **High Cardinality:** Generates many distinct values to allow even chunk splitting.
2. **Even Frequency Distribution:** Prevents hotspotting (all writes directed to one shard).
3. **Query Isolation / Targeting:** Enables common queries to route directly to a single shard instead of broadcasting to all shards.

---

### Q10: What is the difference between a Targeted Query and a Scatter-Gather Query?
**Answer:**  
- **Targeted Query:** When a query filter includes the shard key prefix, `mongos` looks up the chunk map and routes the query directly to **only the specific shard** holding that data (`SINGLE_SHARD`). This achieves maximum parallel throughput.
- **Scatter-Gather Query:** When a query filter omits the shard key, `mongos` cannot determine which shard holds the matching records. It must broadcast the query to **every shard in parallel**, collect partial result streams, and perform an in-memory `SHARD_MERGE` collation, consuming high network and CPU overhead.

---

### Q11: What is a Chunk in MongoDB Sharding?
**Answer:**  
A chunk is a contiguous range of shard key values within a sharded collection. By default, chunk size is 64 MB (or smaller during balancing). When a chunk grows beyond the maximum size, MongoDB splits it into two smaller chunks. If shard document distribution becomes uneven, the background **Balancer process** migrates chunks between shards.

---

### Q12: What Read Preferences does MongoDB support, and what are their use cases?
**Answer:**  
1. **`primary` (Default):** All reads go to the Primary node. Guarantees linearizable strict consistency.
2. **`secondary`:** Reads are routed to Secondary nodes. Achieves horizontal read scalability; eventual consistency (may read slightly lagging data).
3. **`secondaryPreferred`:** Reads from Secondary, falls back to Primary if no Secondary is reachable.
4. **`nearest`:** Reads from the node with lowest network latency (ping), ideal for multi-datacenter deployments.

---

### Q13: What is Replication Lag, and how can it be detected and measured?
**Answer:**  
Replication lag is the delay between a write operation being committed to the Primary's oplog and that same operation being replayed on a Secondary node.
It is measured by comparing the optime timestamp of the Primary against the optime timestamp of the Secondary using `rs.status()` or comparing `local.oplog.rs` latest entries.

---

### Q14: How does MongoDB maintain data integrity during concurrent book borrowings?
**Answer:**  
In our `library_operations.py`, we utilize MongoDB's atomic find-and-modify operation:
```python
db.books.find_one_and_update(
    {"bookId": book_id, "availableCopies": {"$gt": 0}},
    {"$inc": {"availableCopies": -1}},
    return_document=False
)
```
Because MongoDB provides atomic execution at the single-document level in WiredTiger, two concurrent users attempting to borrow the last remaining copy will be serialized; one succeeds and the other receives `None`, completely preventing negative availability.

---

### Q15: What is the WiredTiger Storage Engine, and what concurrency model does it use?
**Answer:**  
WiredTiger is MongoDB's default storage engine. It provides:
- Document-level concurrency control using Multi-Version Concurrency Control (MVCC) and optimistic locking.
- Compression (Snappy / zlib) for data and prefix compression for indexes.
- In-memory cache management with checkpointing every 60 seconds to ensure durability.

---

### Q16: How does a recovered node synchronize after being offline for a long period?
**Answer:**  
When an offline node restarts:
1. If the Primary's oplog still contains all missed transactions since the node went down, the node tails the oplog and catches up incrementally.
2. If the node was down so long that the oplog rolled over (overwritten), it undergoes **Initial Sync**: it drops its local data, copies the entire database snapshot from a healthy member, and rebuilds indexes.

---

### Q17: What are Distributed ACID Transactions in MongoDB?
**Answer:**  
Starting in MongoDB 4.0 (for replica sets) and 4.2 (for sharded clusters), MongoDB supports multi-document, multi-collection distributed ACID transactions using a two-phase commit protocol (2PC) coordinated across shards, ensuring Atomicity, Consistency, Isolation, and Durability across distributed partitions.

---

### Q18: What is the difference between Range-based Sharding and Hashed Sharding?
**Answer:**  
- **Range-based Sharding:** Partitions data based on ranges of shard key values (e.g. $[0, 100)$, $[100, 200)$). Excellent for range queries (`$gte`, `$lte`), but can create write bottlenecks if values are monotonically increasing (e.g. auto-increment IDs).
- **Hashed Sharding:** Computes an MD5 hash of the shard key value and distributes chunks uniformly. Ensures perfectly balanced writes across all shards, but converts range queries into scatter-gather broadcasts.

---

### Q19: Why can Standalone MongoDB sometimes appear faster than a Replica Set or Sharded Cluster on a single laptop?
**Answer:**  
On a single developer computer, all database nodes share the exact same physical CPU, RAM, and disk storage bus. In a standalone setup, writes write to one cache with no network overhead. In a replica set or sharded cluster on one machine, multiple background processes contend for the same disk I/O, plus TCP socket marshaling and oplog replication overhead. In a real data center across separate servers, sharding delivers massive linear performance gains that cannot fit on a single computer.

---

### Q20: What happens if two voting members in a 3-node replica set crash simultaneously?
**Answer:**  
If 2 of 3 nodes crash, only 1 node survives. Because $1 < \text{Quorum} (2)$, the surviving node cannot reach majority. If it was a Secondary, it cannot elect itself as Primary. If it was the Primary, it detects lost heartbeats from the majority and **steps down to Secondary**. The cluster becomes strictly read-only (if secondary reads are enabled) until at least one failed node is restored.
