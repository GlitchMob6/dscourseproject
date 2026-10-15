// MongoDB Sharded Cluster Initialization Script
// Connects to mongos on port 27050 to add shards, enable sharding, and shard the books collection

print("===============================================================");
print("Configuring Sharded Cluster via mongos (127.0.0.1:27050)...");
print("===============================================================");

// 1. Add Shards
try {
  print("Adding Shard 1 (shard1-rs)...");
  const res1 = sh.addShard("shard1-rs/127.0.0.1:27200");
  printjson(res1);
} catch (e) {
  print("Shard 1 note: " + e);
}

try {
  print("Adding Shard 2 (shard2-rs)...");
  const res2 = sh.addShard("shard2-rs/127.0.0.1:27300");
  printjson(res2);
} catch (e) {
  print("Shard 2 note: " + e);
}

// 2. Enable Sharding for library_db
print("\nEnabling sharding for database 'library_db'...");
try {
  const shDbRes = sh.enableSharding("library_db");
  printjson(shDbRes);
} catch (e) {
  print("enableSharding note: " + e);
}

// 3. Shard the books collection on { category: 1, bookId: 1 }
print("\nCreating index and sharding collection 'library_db.books' on { category: 1, bookId: 1 }...");
try {
  const dbBooks = db.getSiblingDB("library_db").books;
  dbBooks.createIndex({ category: 1, bookId: 1 });
  const shCollRes = sh.shardCollection("library_db.books", { category: 1, bookId: 1 });
  printjson(shCollRes);
} catch (e) {
  print("shardCollection note: " + e);
}

print("\n--- Current Sharded Cluster Status ---");
sh.status();
