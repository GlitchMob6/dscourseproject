// MongoDB Replica Set Initialization Script for Library Management System
// Replica Set Name: rs0 (3 Data-Bearing Nodes)

const config = {
  _id: "rs0",
  members: [
    { _id: 0, host: "127.0.0.1:27018", priority: 2 },  // Preferred Primary (higher priority)
    { _id: 1, host: "127.0.0.1:27019", priority: 1 },  // Secondary
    { _id: 2, host: "127.0.0.1:27020", priority: 1 }   // Secondary
  ]
};

print("===============================================================");
print("Initiating Replica Set 'rs0' on 127.0.0.1:27018...");
print("===============================================================");

try {
  const res = rs.initiate(config);
  printjson(res);
} catch (err) {
  print("Replica set might already be initiated: " + err);
}

print("Waiting for primary election...");
let elected = false;
for (let i = 0; i < 25; i++) {
  sleep(1000);
  try {
    const hello = db.hello();
    if (hello.isWritablePrimary) {
      print(">>> SUCCESS: Primary elected on node: " + hello.me);
      elected = true;
      break;
    }
  } catch (e) {}
  print("Election in progress... (" + (i + 1) + "s)");
}

if (!elected) {
  print("Notice: Check rs.status() to verify cluster convergence.");
}

print("\n--- Summary of Replica Set Members ---");
try {
  const status = rs.status();
  status.members.forEach(m => {
    print("Member ID: " + m._id + " | Host: " + m.name + " | State: " + m.stateStr + " | Health: " + m.health);
  });
} catch (e) {
  print("Could not retrieve rs.status(): " + e);
}
