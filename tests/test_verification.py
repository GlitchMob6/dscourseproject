"""
test_verification.py - Comprehensive Unit & Integration Test Suite
Verifies:
  1. LibraryService core business logic & edge cases
  2. Concurrency-safe atomic issue & return operations
  3. FastAPI REST endpoints & JSON payloads
  4. Live Replica Set status & consistency checks
  5. Safe cleanup of all generated test data
"""

import sys
import os
import unittest
import threading
import uuid
import time
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.database import DatabaseManager
from app.library_operations import LibraryService
from fastapi.testclient import TestClient
from api.main import app


class TestLibraryService(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db_mgr = DatabaseManager.get_instance()
        cls.db = cls.db_mgr.get_db()
        cls.service = LibraryService()
        cls.test_prefix = f"UT-{uuid.uuid4().hex[:6].upper()}"

    @classmethod
    def tearDownClass(cls):
        # Clean up any test records created with test_prefix
        cls.db.books.delete_many({"bookId": {"$regex": f"^{cls.test_prefix}"}})
        cls.db.members.delete_many({"memberId": {"$regex": f"^{cls.test_prefix}"}})
        cls.db.transactions.delete_many({"bookId": {"$regex": f"^{cls.test_prefix}"}})

    def test_01_add_book_and_validations(self):
        """Test book addition and negative/invalid copy validations."""
        b_id = f"{self.test_prefix}-BK-01"
        # Valid book
        ok, msg = self.service.add_book(b_id, "Test Book 1", "Author A", "Tech", 3)
        self.assertTrue(ok, f"Failed to add book: {msg}")

        # Duplicate ID rejection
        ok, msg = self.service.add_book(b_id, "Test Book Duplicate", "Author B", "Tech", 2)
        self.assertFalse(ok)
        self.assertIn("already exists", msg.lower())

        # Zero copies rejection
        ok, msg = self.service.add_book(f"{self.test_prefix}-BK-ZERO", "Zero Book", "Author", "Tech", 0)
        self.assertFalse(ok)
        self.assertIn("positive integer", msg.lower())

        # Negative copies rejection
        ok, msg = self.service.add_book(f"{self.test_prefix}-BK-NEG", "Neg Book", "Author", "Tech", -2)
        self.assertFalse(ok)
        self.assertIn("positive integer", msg.lower())

    def test_02_member_registration(self):
        """Test member registration and duplicate ID rejection."""
        m_id = f"{self.test_prefix}-MEM-01"
        ok, msg = self.service.register_member(m_id, "Alice Smith", "Computer Science")
        self.assertTrue(ok, f"Failed to register member: {msg}")

        # Duplicate member
        ok, msg = self.service.register_member(m_id, "Alice Duplicate", "CS")
        self.assertFalse(ok)
        self.assertIn("already registered", msg.lower())

    def test_03_issue_and_return_lifecycle(self):
        """Test normal issue and return flow, availability counts, and duplicate active loan prevention."""
        b_id = f"{self.test_prefix}-BK-02"
        m_id = f"{self.test_prefix}-MEM-02"
        self.service.add_book(b_id, "Distributed Algorithms", "Nancy Lynch", "Theory", 2)
        self.service.register_member(m_id, "Bob Jones", "Information Tech")

        # Issue 1 copy
        ok, msg = self.service.issue_book(b_id, m_id)
        self.assertTrue(ok, f"Issue failed: {msg}")

        book = self.db.books.find_one({"bookId": b_id})
        self.assertEqual(book["availableCopies"], 1)

        # Attempt to issue same book again to same member (should be rejected)
        ok_dup, msg_dup = self.service.issue_book(b_id, m_id)
        self.assertFalse(ok_dup, "Should reject duplicate active loan of the same book to the same member")
        self.assertIn("already has an active borrowed copy", msg_dup)

        # Return book
        ok_ret, msg_ret = self.service.return_book(b_id, m_id)
        self.assertTrue(ok_ret, f"Return failed: {msg_ret}")

        book_after = self.db.books.find_one({"bookId": b_id})
        self.assertEqual(book_after["availableCopies"], 2)

        # Attempt to return again (should fail gracefully)
        ok_ret_again, msg_ret_again = self.service.return_book(b_id, m_id)
        self.assertFalse(ok_ret_again)
        self.assertIn("no active issued transaction", msg_ret_again.lower())

    def test_04_concurrency_issue_last_copy(self):
        """Concurrent requests attempting to issue the last available copy. Exactly 1 must win."""
        b_id = f"{self.test_prefix}-BK-CONC"
        self.service.add_book(b_id, "Race Condition Guide", "Leslie Lamport", "Concurrency", 1)

        # Register 10 distinct members
        members = []
        for i in range(10):
            m_id = f"{self.test_prefix}-MCONC-{i}"
            self.service.register_member(m_id, f"Member {i}", "Engineering")
            members.append(m_id)

        results = []

        def _worker(m_id):
            ok, msg = self.service.issue_book(b_id, m_id)
            results.append((ok, msg))

        threads = [threading.Thread(target=_worker, args=(m,)) for m in members]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        successes = [r for r in results if r[0] is True]
        failures = [r for r in results if r[0] is False]

        self.assertEqual(len(successes), 1, f"Expected exactly 1 success, got {len(successes)}")
        self.assertEqual(len(failures), 9, f"Expected exactly 9 failures, got {len(failures)}")

        final_book = self.db.books.find_one({"bookId": b_id})
        self.assertEqual(final_book["availableCopies"], 0, "Available copies dropped below zero or was incorrect!")

    def test_05_concurrency_return_same_transaction(self):
        """Concurrent return calls on the same active loan. Exactly 1 must succeed."""
        b_id = f"{self.test_prefix}-BK-RET"
        m_id = f"{self.test_prefix}-MEM-RET"
        self.service.add_book(b_id, "Atomic Transactions", "Jim Gray", "Databases", 2)
        self.service.register_member(m_id, "Concurrent Returner", "Systems")
        self.service.issue_book(b_id, m_id)

        txn = self.db.transactions.find_one({"bookId": b_id, "memberId": m_id, "status": "ISSUED"})
        self.assertIsNotNone(txn)
        txn_id = txn["transactionId"]

        ret_results = []

        def _ret_worker():
            ok, msg = self.service.return_book(txn_id)
            ret_results.append((ok, msg))

        threads = [threading.Thread(target=_ret_worker) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        ret_successes = [r for r in ret_results if r[0] is True]
        self.assertEqual(len(ret_successes), 1, "Only 1 concurrent return should succeed")

        book_after = self.db.books.find_one({"bookId": b_id})
        self.assertEqual(book_after["availableCopies"], 2, "Available copies incremented more than once!")

    def test_06_delete_book_protection(self):
        """Cannot delete book while copies are currently issued."""
        b_id = f"{self.test_prefix}-BK-DEL"
        m_id = f"{self.test_prefix}-MEM-DEL"
        self.service.add_book(b_id, "Protected Book", "Author", "Security", 2)
        self.service.register_member(m_id, "Borrower", "Sec")
        self.service.issue_book(b_id, m_id)

        # Deletion blocked
        ok, msg = self.service.delete_book(b_id)
        self.assertFalse(ok)
        self.assertIn("currently issued", msg.lower())

        # Return book, then deletion should succeed
        self.service.return_book(b_id, m_id)
        ok_del, msg_del = self.service.delete_book(b_id)
        self.assertTrue(ok_del, f"Delete failed: {msg_del}")


class TestFastAPIRoutes(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.test_prefix = f"API-{uuid.uuid4().hex[:6].upper()}"

    @classmethod
    def tearDownClass(cls):
        db = DatabaseManager.get_instance().get_db()
        db.books.delete_many({"bookId": {"$regex": f"^{cls.test_prefix}"}})
        db.members.delete_many({"memberId": {"$regex": f"^{cls.test_prefix}"}})
        db.transactions.delete_many({"bookId": {"$regex": f"^{cls.test_prefix}"}})

    def test_health_endpoint(self):
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("connected"))
        self.assertIn("mode", data)
        self.assertIn("stats", data)

    def test_connectivity_endpoint(self):
        res = self.client.get("/api/health/connectivity")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("replica_set", data)
        self.assertTrue(data["replica_set"]["available"])

    def test_books_crud_api(self):
        b_id = f"{self.test_prefix}-BK"
        # 1. Add book
        add_res = self.client.post("/api/books", json={
            "bookId": b_id,
            "title": "API Verification Book",
            "author": "FastAPI Tester",
            "category": "Testing",
            "totalCopies": 3
        })
        self.assertEqual(add_res.status_code, 200)
        self.assertTrue(add_res.json()["success"])

        # 2. Get book
        get_res = self.client.get(f"/api/books/{b_id}")
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.json()["book"]["title"], "API Verification Book")

        # 3. Update book
        up_res = self.client.put(f"/api/books/{b_id}", json={"title": "Updated API Title", "totalCopies": 5})
        self.assertEqual(up_res.status_code, 200)
        self.assertTrue(up_res.json()["success"])

        # Verify update
        get_up = self.client.get(f"/api/books/{b_id}")
        self.assertEqual(get_up.json()["book"]["title"], "Updated API Title")
        self.assertEqual(get_up.json()["book"]["totalCopies"], 5)

        # 4. Delete book
        del_res = self.client.delete(f"/api/books/{b_id}")
        self.assertEqual(del_res.status_code, 200)
        self.assertTrue(del_res.json()["success"])

    def test_members_crud_api(self):
        m_id = f"{self.test_prefix}-MEM"
        # Register member
        reg_res = self.client.post("/api/members", json={
            "memberId": m_id,
            "name": "API Member",
            "department": "Quality Assurance"
        })
        self.assertEqual(reg_res.status_code, 200)
        self.assertTrue(reg_res.json()["success"])

        # Get member
        get_res = self.client.get(f"/api/members/{m_id}")
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.json()["member"]["name"], "API Member")

    def test_issue_return_transactions_api(self):
        b_id = f"{self.test_prefix}-TXN-BK"
        m_id = f"{self.test_prefix}-TXN-MEM"
        self.client.post("/api/books", json={
            "bookId": b_id, "title": "Txn Book", "author": "Txn Author", "category": "Txn", "totalCopies": 2
        })
        self.client.post("/api/members", json={
            "memberId": m_id, "name": "Txn Member", "department": "Txn Dept"
        })

        # Issue
        issue_res = self.client.post("/api/books/issue", json={"bookId": b_id, "memberId": m_id})
        self.assertEqual(issue_res.status_code, 200)
        self.assertTrue(issue_res.json()["success"])

        # Return
        ret_res = self.client.post("/api/books/return", json={"bookId": b_id, "memberId": m_id})
        self.assertEqual(ret_res.status_code, 200)
        self.assertTrue(ret_res.json()["success"])

        # Check transaction history
        hist_res = self.client.get("/api/books/transactions/history?limit=10")
        self.assertEqual(hist_res.status_code, 200)
        self.assertIn("transactions", hist_res.json())

    def test_replication_status_endpoint(self):
        res = self.client.get("/api/replication/status")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data.get("connected"))
        self.assertEqual(data.get("setName"), "rs0")
        self.assertEqual(len(data.get("members", [])), 3)


if __name__ == "__main__":
    unittest.main(verbosity=2)
