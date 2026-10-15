"""
main.py - Interactive Command-Line Interface for
Implementation of Distributed Databases Using MongoDB: A Library Management System
"""

import sys
import os

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from app.database import DatabaseManager
from app.library_operations import LibraryService
import replication.replication_test as rep_test
import replication.failover_test as fo_test
import replication.consistency_test as const_test
import sharding.sharding_test as shard_test
import sharding.distributed_query_test as dq_test
import experiments.performance_test as perf_test

def print_header(cluster_status):
    mode = cluster_status.get("mode", "UNKNOWN")
    primary = cluster_status.get("primary_host", "N/A")
    set_name = cluster_status.get("set_name", "N/A")

    print("\n" + "=" * 78)
    print("      IMPLEMENTATION OF DISTRIBUTED DATABASES USING MONGODB")
    print("                 LIBRARY MANAGEMENT SYSTEM (CLI)")
    print("=" * 78)
    print(f" [Cluster Mode]: {mode:<14} | [Set Name]: {set_name:<10} | [Active Primary]: {primary}")
    print("=" * 78)

def print_menu():
    print("""
 --- [LIBRARY OPERATIONS] -----------------------------------------------------
  1. Add Book
  2. View All Books
  3. Search Book (by ID, Title, Author, or Category)
  4. Update Book
  5. Delete Book
  6. Register Member
  7. Issue Book (Atomic availability decrement)
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
    """)

def main():
    db_mgr = DatabaseManager.get_instance()
    lib_service = LibraryService()

    while True:
        status = db_mgr.get_cluster_status()
        print_header(status)
        print_menu()

        choice = input("Enter choice (1-17) [or 'm' to switch DB mode]: ").strip()

        if choice == "1":
            print("\n--- ADD NEW BOOK ---")
            book_id = input("Enter Book ID (e.g. BK-101): ").strip()
            title = input("Enter Book Title: ").strip()
            author = input("Enter Author: ").strip()
            category = input("Enter Category (e.g. Computer Science, Mathematics): ").strip()
            copies = input("Enter Total Copies: ").strip()
            success, msg = lib_service.add_book(book_id, title, author, category, copies)
            print(f"\n{msg}")

        elif choice == "2":
            lib_service.display_all_books()

        elif choice == "3":
            print("\n--- SEARCH BOOK ---")
            print("1. Search by Book ID")
            print("2. Search by Title")
            print("3. Search by Author")
            print("4. Search by Category")
            sub = input("Select field (1-4): ").strip()
            val = input("Enter search query: ").strip()
            lib_service.search_books(sub, val)

        elif choice == "4":
            print("\n--- UPDATE BOOK ---")
            book_id = input("Enter Book ID to update: ").strip()
            print("Leave field blank to keep current value:")
            title = input("New Title: ").strip() or None
            author = input("New Author: ").strip() or None
            category = input("New Category: ").strip() or None
            copies = input("New Total Copies: ").strip() or None
            success, msg = lib_service.update_book(book_id, title, author, category, copies)
            print(f"\n{msg}")

        elif choice == "5":
            print("\n--- DELETE BOOK ---")
            book_id = input("Enter Book ID to delete: ").strip()
            confirm = input(f"Are you sure you want to delete '{book_id}'? (y/N): ").strip().lower()
            if confirm == "y":
                success, msg = lib_service.delete_book(book_id)
                print(f"\n{msg}")
            else:
                print("Deletion cancelled.")

        elif choice == "6":
            print("\n--- MEMBER MANAGEMENT ---")
            print("1. Register New Member")
            print("2. Display Registered Members")
            m_sub = input("Select option (1/2): ").strip()
            if m_sub == "2":
                lib_service.display_members()
            else:
                member_id = input("Enter Member ID (e.g. MEM-001): ").strip()
                name = input("Enter Member Full Name: ").strip()
                dept = input("Enter Department (e.g. CSE, IT, MECH): ").strip()
                success, msg = lib_service.register_member(member_id, name, dept)
                print(f"\n{msg}")

        elif choice == "7":
            print("\n--- ISSUE BOOK ---")
            book_id = input("Enter Book ID: ").strip()
            member_id = input("Enter Member ID: ").strip()
            success, msg = lib_service.issue_book(book_id, member_id)
            print(f"\n{msg}")

        elif choice == "8":
            print("\n--- RETURN BOOK ---")
            val = input("Enter Transaction ID (or Book ID): ").strip()
            mem = None
            if not val.startswith("TXN-"):
                mem = input("Enter Member ID: ").strip()
            success, msg = lib_service.return_book(val, mem)
            print(f"\n{msg}")

        elif choice == "9":
            print("\n--- BORROWING HISTORY & AVAILABILITY ---")
            print("1. View Current Availability Breakdown")
            print("2. View Full Transaction History")
            sub = input("Select option (1/2): ").strip()
            if sub == "1":
                lib_service.display_availability_status()
            else:
                lib_service.display_borrowing_history()

        elif choice == "10":
            fo_test.display_cluster_health()

        elif choice == "11":
            rep_test.run_replication_experiment()

        elif choice == "12":
            print("\n--- FAULT TOLERANCE & ELECTION SIMULATION ---")
            print("1. Simulate Secondary Node Crash (Concept 2: Fault Tolerance)")
            print("2. Simulate Primary Crash & Automatic Failover (Concept 3: Leader Election)")
            print("3. Run Full Combined Simulation")
            sim_choice = input("Select experiment (1-3): ").strip()
            if sim_choice == "1":
                fo_test.run_fault_tolerance_demo()
            elif sim_choice == "2":
                fo_test.run_failover_demo()
            else:
                fo_test.run_fault_tolerance_demo()
                fo_test.run_failover_demo()

        elif choice == "13":
            const_test.run_consistency_experiment()

        elif choice == "14":
            shard_test.run_sharding_verification()

        elif choice == "15":
            dq_test.run_distributed_query_experiment()

        elif choice == "16":
            perf_test.run_performance_comparison()

        elif choice.lower() == "m":
            print("\n--- SWITCH CLUSTER CONNECTION MODE ---")
            print("1. Stage A: Replica Set (localhost:27018, 27019, 27020 - rs0)")
            print("2. Stage B: Sharded Cluster via mongos (localhost:27050)")
            print("3. Standalone Node (localhost:27017)")
            m_sub = input("Select mode (1-3): ").strip()
            if m_sub == "1":
                ok, msg = db_mgr.switch_cluster_mode("REPLICA_SET")
            elif m_sub == "2":
                ok, msg = db_mgr.switch_cluster_mode("SHARDED")
            else:
                ok, msg = db_mgr.switch_cluster_mode("STANDALONE")
            print(f"\n{msg}")

        elif choice == "17":
            print("\n[+] Exiting Distributed Library Management System. Goodbye!\n")
            sys.exit(0)

        else:
            print("[!] Invalid option. Please enter a number between 1 and 17.")

        input("\nPress Enter to return to main menu...")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nProgram terminated by user.")
        sys.exit(0)
