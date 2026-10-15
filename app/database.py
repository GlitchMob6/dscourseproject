"""
database.py - MongoDB Connection Manager and Schema Initializer
Supports:
  1. Stage A Replica Set (rs0 on 27018, 27019, 27020)
  2. Stage B Sharded Cluster (mongos on 27050)
  3. Standalone Fallback (default port 27017)
"""

import sys
import pymongo
from pymongo import MongoClient, ReadPreference
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

# Standard connection URIs
REPLICA_SET_URI = "mongodb://127.0.0.1:27018,127.0.0.1:27019,127.0.0.1:27020/?replicaSet=rs0&serverSelectionTimeoutMS=3000"
SHARDED_CLUSTER_URI = "mongodb://127.0.0.1:27050/?serverSelectionTimeoutMS=3000"
STANDALONE_URI = "mongodb://127.0.0.1:27017/?serverSelectionTimeoutMS=3000"

DB_NAME = "library_db"

class DatabaseManager:
    _instance = None

    def __init__(self):
        self.current_mode = "REPLICA_SET"
        self.uri = REPLICA_SET_URI
        self.client = None
        self.db = None
        self.connect()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = DatabaseManager()
        return cls._instance

    def connect(self, mode=None):
        if mode:
            self.current_mode = mode
            if mode == "REPLICA_SET":
                self.uri = REPLICA_SET_URI
            elif mode == "SHARDED":
                self.uri = SHARDED_CLUSTER_URI
            elif mode == "STANDALONE":
                self.uri = STANDALONE_URI

        try:
            if self.client:
                self.client.close()
            self.client = MongoClient(self.uri)
            # Force server check
            self.client.admin.command('ping')
            self.db = self.client[DB_NAME]
            self.initialize_schema()
            return True, f"Connected to {self.current_mode} successfully."
        except (ServerSelectionTimeoutError, ConnectionFailure) as e:
            # Fallback strategy
            if self.current_mode == "REPLICA_SET":
                # Try fallback to Standalone if Replica Set is not started
                try:
                    fallback_client = MongoClient(STANDALONE_URI)
                    fallback_client.admin.command('ping')
                    self.client = fallback_client
                    self.db = self.client[DB_NAME]
                    self.current_mode = "STANDALONE"
                    self.initialize_schema()
                    return True, "Notice: Replica Set offline. Fallback connected to Standalone (27017)."
                except Exception:
                    pass
            return False, f"Could not connect to {self.current_mode} at {self.uri}: {e}"

    def get_db(self):
        if self.db is None:
            self.connect()
        return self.db

    def initialize_schema(self):
        """Creates unique indexes to enforce data integrity."""
        try:
            # Books: unique on bookId
            self.db.books.create_index([("bookId", pymongo.ASCENDING)], unique=True)
            # Index on category for sharding / targeted queries
            self.db.books.create_index([("category", pymongo.ASCENDING), ("bookId", pymongo.ASCENDING)])
            self.db.books.create_index([("title", pymongo.ASCENDING)])
            self.db.books.create_index([("author", pymongo.ASCENDING)])

            # Members: unique on memberId
            self.db.members.create_index([("memberId", pymongo.ASCENDING)], unique=True)

            # Transactions: unique on transactionId
            self.db.transactions.create_index([("transactionId", pymongo.ASCENDING)], unique=True)
            self.db.transactions.create_index([("bookId", pymongo.ASCENDING)])
            self.db.transactions.create_index([("memberId", pymongo.ASCENDING)])
            self.db.transactions.create_index([("status", pymongo.ASCENDING)])
        except Exception as e:
            print(f"[Schema Init Warning]: {e}")

    def switch_cluster_mode(self, mode):
        """Switch between REPLICA_SET, SHARDED, and STANDALONE modes."""
        success, message = self.connect(mode)
        return success, message

    def get_cluster_status(self):
        """Inspects connection details, hello command, and replica set info."""
        try:
            hello = self.client.admin.command('hello')
            status = {
                "mode": self.current_mode,
                "uri": self.uri,
                "is_primary": hello.get("isWritablePrimary", False),
                "is_secondary": hello.get("secondary", False),
                "primary_host": hello.get("primary", "N/A"),
                "me": hello.get("me", "Standalone/Router"),
                "hosts": hello.get("hosts", []),
                "set_name": hello.get("setName", "N/A"),
                "msg": hello.get("msg", "Normal Node")  # 'isdbgrid' for mongos
            }
            return status
        except Exception as e:
            return {"error": str(e), "mode": self.current_mode}
