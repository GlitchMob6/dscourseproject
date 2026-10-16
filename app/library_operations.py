"""
library_operations.py - Library Management System Business Logic
Features:
  1. Add new book
  2. Display all books
  3. Search books (bookId, title, author, category)
  4. Update book
  5. Delete book (with active borrow validation)
  6. Register library member
  7. Display registered members
  8. Issue book (atomic concurrency-safe availability decrement)
  9. Return book (atomic increment & transaction update)
  10. Display available and borrowed books
  11. Display borrowing history
"""

from datetime import datetime
import uuid
from tabulate import tabulate
from app.database import DatabaseManager

class LibraryService:
    def __init__(self):
        self.db_mgr = DatabaseManager.get_instance()

    @property
    def db(self):
        return self.db_mgr.get_db()

    # ---------------------------------------------------------
    # 1. Add Book
    # ---------------------------------------------------------
    def add_book(self, book_id, title, author, category, total_copies):
        if not book_id or not title or not author or not category:
            return False, "Error: All fields are mandatory."
        try:
            total_copies = int(total_copies)
            if total_copies <= 0:
                return False, "Error: Total copies must be a positive integer."
        except ValueError:
            return False, "Error: Copies must be a valid integer."

        book_doc = {
            "bookId": str(book_id).strip(),
            "title": str(title).strip(),
            "author": str(author).strip(),
            "category": str(category).strip(),
            "totalCopies": total_copies,
            "availableCopies": total_copies,
            "createdAt": datetime.now().isoformat()
        }

        try:
            self.db.books.insert_one(book_doc)
            return True, f"Book '{title}' [ID: {book_id}] added successfully."
        except Exception as e:
            if "duplicate key" in str(e).lower() or "E11000" in str(e):
                return False, f"Error: Book ID '{book_id}' already exists."
            return False, f"Database Error: {e}"

    # ---------------------------------------------------------
    # 2. Display All Books
    # ---------------------------------------------------------
    def display_all_books(self, limit=50):
        try:
            books = list(self.db.books.find({}, {"_id": 0}).limit(limit))
            if not books:
                print("\n[!] No books found in the library database.")
                return

            table_data = []
            for b in books:
                table_data.append([
                    b.get("bookId", "-"),
                    b.get("title", "-"),
                    b.get("author", "-"),
                    b.get("category", "-"),
                    b.get("totalCopies", 0),
                    b.get("availableCopies", 0)
                ])

            headers = ["Book ID", "Title", "Author", "Category", "Total", "Available"]
            print(f"\n=== Library Books (Displaying {len(books)} records) ===")
            print(tabulate(table_data, headers=headers, tablefmt="grid"))
        except Exception as e:
            print(f"[!] Error fetching books: {e}")

    # ---------------------------------------------------------
    # 3. Search Books
    # ---------------------------------------------------------
    def search_books(self, search_by, query_value):
        query_map = {
            "1": "bookId",
            "2": "title",
            "3": "author",
            "4": "category"
        }
        field = query_map.get(str(search_by).strip())
        if not field:
            print("[!] Invalid search field.")
            return

        # Case-insensitive regex for string fields, exact for bookId
        if field == "bookId":
            mongo_filter = {field: str(query_value).strip()}
        else:
            mongo_filter = {field: {"$regex": str(query_value).strip(), "$options": "i"}}

        try:
            results = list(self.db.books.find(mongo_filter, {"_id": 0}))
            if not results:
                print(f"\n[-] No books matched the query '{query_value}' in field '{field}'.")
                return

            table_data = [
                [b.get("bookId"), b.get("title"), b.get("author"), b.get("category"), b.get("totalCopies"), b.get("availableCopies")]
                for b in results
            ]
            headers = ["Book ID", "Title", "Author", "Category", "Total", "Available"]
            print(f"\n=== Search Results for '{query_value}' ({len(results)} found) ===")
            print(tabulate(table_data, headers=headers, tablefmt="grid"))
        except Exception as e:
            print(f"[!] Error searching books: {e}")

    # ---------------------------------------------------------
    # 4. Update Book Information
    # ---------------------------------------------------------
    def update_book(self, book_id, title=None, author=None, category=None, total_copies=None):
        existing = self.db.books.find_one({"bookId": str(book_id).strip()})
        if not existing:
            return False, f"Book ID '{book_id}' not found."

        update_fields = {}
        if title: update_fields["title"] = title.strip()
        if author: update_fields["author"] = author.strip()
        if category: update_fields["category"] = category.strip()

        if total_copies is not None:
            try:
                new_total = int(total_copies)
                if new_total <= 0:
                    return False, "Error: Total copies must be a positive integer."
                borrowed = existing["totalCopies"] - existing["availableCopies"]
                if new_total < borrowed:
                    return False, f"Cannot reduce total to {new_total}. {borrowed} copies are currently borrowed."
                update_fields["totalCopies"] = new_total
                update_fields["availableCopies"] = new_total - borrowed
            except ValueError:
                return False, "Total copies must be a number."

        if not update_fields:
            return False, "No fields provided to update."

        update_fields["updatedAt"] = datetime.now().isoformat()
        try:
            self.db.books.update_one({"bookId": str(book_id).strip()}, {"$set": update_fields})
            return True, f"Book ID '{book_id}' updated successfully."
        except Exception as e:
            return False, f"Error updating book: {e}"

    # ---------------------------------------------------------
    # 5. Delete Book
    # ---------------------------------------------------------
    def delete_book(self, book_id):
        book = self.db.books.find_one({"bookId": str(book_id).strip()})
        if not book:
            return False, f"Book ID '{book_id}' does not exist."

        borrowed = book.get("totalCopies", 0) - book.get("availableCopies", 0)
        active_loans = self.db.transactions.count_documents({"bookId": str(book_id).strip(), "status": "ISSUED"})
        if borrowed > 0 or active_loans > 0:
            count = max(borrowed, active_loans)
            return False, f"Cannot delete book. {count} copies are currently issued to members."

        try:
            self.db.books.delete_one({"bookId": str(book_id).strip()})
            return True, f"Book '{book.get('title')}' [ID: {book_id}] deleted successfully."
        except Exception as e:
            return False, f"Error deleting book: {e}"

    # ---------------------------------------------------------
    # 6. Register Member
    # ---------------------------------------------------------
    def register_member(self, member_id, name, department):
        if not member_id or not name or not department:
            return False, "Error: Member ID, Name, and Department are all required."

        member_doc = {
            "memberId": str(member_id).strip(),
            "name": str(name).strip(),
            "department": str(department).strip(),
            "registeredAt": datetime.now().isoformat()
        }

        try:
            self.db.members.insert_one(member_doc)
            return True, f"Member '{name}' [ID: {member_id}] registered successfully."
        except Exception as e:
            if "duplicate key" in str(e).lower() or "E11000" in str(e):
                return False, f"Error: Member ID '{member_id}' is already registered."
            return False, f"Database Error: {e}"

    # ---------------------------------------------------------
    # 7. Display Registered Members
    # ---------------------------------------------------------
    def display_members(self):
        try:
            members = list(self.db.members.find({}, {"_id": 0}))
            if not members:
                print("\n[-] No registered members found.")
                return

            table_data = [
                [m.get("memberId"), m.get("name"), m.get("department"), m.get("registeredAt", "-")[:19]]
                for m in members
            ]
            headers = ["Member ID", "Name", "Department", "Registration Date"]
            print(f"\n=== Registered Library Members ({len(members)}) ===")
            print(tabulate(table_data, headers=headers, tablefmt="grid"))
        except Exception as e:
            print(f"[!] Error displaying members: {e}")

    # ---------------------------------------------------------
    # 8. Issue Book (Safe Atomic Concurrency)
    # ---------------------------------------------------------
    def issue_book(self, book_id, member_id):
        book_id = str(book_id).strip()
        member_id = str(member_id).strip()

        # Check member existence
        member = self.db.members.find_one({"memberId": member_id})
        if not member:
            return False, f"Error: Member ID '{member_id}' does not exist. Register member first."

        # Check if member already has an active loan of this book
        active_loan = self.db.transactions.find_one({
            "bookId": book_id,
            "memberId": member_id,
            "status": "ISSUED"
        })
        if active_loan:
            return False, f"Error: Member '{member.get('name')}' already has an active borrowed copy of this book (Txn: {active_loan.get('transactionId')})."

        # Atomically check availability and decrement availableCopies
        # $gt: 0 ensures no race condition can drop copies below zero
        updated_book = self.db.books.find_one_and_update(
            {"bookId": book_id, "availableCopies": {"$gt": 0}},
            {"$inc": {"availableCopies": -1}},
            return_document=False
        )

        if not updated_book:
            book_check = self.db.books.find_one({"bookId": book_id})
            if not book_check:
                return False, f"Error: Book ID '{book_id}' does not exist."
            else:
                return False, f"Error: Book '{book_check.get('title')}' has 0 available copies currently."

        # Generate unique transaction ID
        trans_id = f"TXN-{uuid.uuid4().hex[:8].upper()}"
        txn_doc = {
            "transactionId": trans_id,
            "bookId": book_id,
            "bookTitle": updated_book.get("title"),
            "memberId": member_id,
            "memberName": member.get("name"),
            "issueDate": datetime.now().isoformat(),
            "returnDate": None,
            "status": "ISSUED"
        }
        try:
            self.db.transactions.insert_one(txn_doc)
        except Exception as e:
            # Rollback availability decrement if recording transaction fails
            self.db.books.update_one(
                {"bookId": book_id},
                {"$inc": {"availableCopies": 1}}
            )
            return False, f"Transaction Error: Failed to record loan. Book availability restored. ({e})"

        return True, f"SUCCESS: Book '{updated_book.get('title')}' issued to {member.get('name')}.\nTransaction ID: {trans_id}"

    # ---------------------------------------------------------
    # 9. Return Book (Atomic Safe Concurrency)
    # ---------------------------------------------------------
    def return_book(self, transaction_id_or_book_id, member_id=None):
        val = str(transaction_id_or_book_id).strip()

        # Try matching by transactionId
        txn = self.db.transactions.find_one({"transactionId": val, "status": "ISSUED"})

        # If not, try matching by bookId and memberId
        if not txn and member_id:
            txn = self.db.transactions.find_one({
                "bookId": val,
                "memberId": str(member_id).strip(),
                "status": "ISSUED"
            })

        if not txn:
            return False, "Error: No active ISSUED transaction found for given details."

        # Atomically transition transaction status from ISSUED to RETURNED
        return_time = datetime.now().isoformat()
        updated_txn = self.db.transactions.find_one_and_update(
            {"_id": txn["_id"], "status": "ISSUED"},
            {"$set": {"status": "RETURNED", "returnDate": return_time}},
            return_document=False
        )

        if not updated_txn:
            return False, "Error: Transaction was already returned or is no longer active."

        # Atomically restore availableCopies
        self.db.books.update_one(
            {"bookId": txn["bookId"]},
            {"$inc": {"availableCopies": 1}}
        )

        return True, f"SUCCESS: Book '{txn.get('bookTitle', txn['bookId'])}' returned by {txn.get('memberName', txn['memberId'])}.\nReturn Timestamp: {return_time[:19]}"

    # ---------------------------------------------------------
    # 10. Display Available and Borrowed Books
    # ---------------------------------------------------------
    def display_availability_status(self):
        try:
            available = list(self.db.books.find({"availableCopies": {"$gt": 0}}, {"_id": 0}))
            borrowed_txns = list(self.db.transactions.find({"status": "ISSUED"}, {"_id": 0}))

            print(f"\n================ AVAILABLE BOOKS ({len(available)}) ================")
            if available:
                table_avail = [
                    [b.get("bookId"), b.get("title"), b.get("category"), b.get("availableCopies"), b.get("totalCopies")]
                    for b in available
                ]
                print(tabulate(table_avail, headers=["Book ID", "Title", "Category", "Available", "Total"], tablefmt="grid"))
            else:
                print("[-] No books currently available for borrowing.")

            print(f"\n================ CURRENTLY BORROWED COPIES ({len(borrowed_txns)}) ================")
            if borrowed_txns:
                table_borrowed = [
                    [t.get("transactionId"), t.get("bookId"), t.get("bookTitle"), t.get("memberId"), t.get("memberName"), t.get("issueDate", "-")[:19]]
                    for t in borrowed_txns
                ]
                print(tabulate(table_borrowed, headers=["Txn ID", "Book ID", "Title", "Member ID", "Member Name", "Issue Date"], tablefmt="grid"))
            else:
                print("[-] No books are currently borrowed.")
        except Exception as e:
            print(f"[!] Error fetching availability: {e}")

    # ---------------------------------------------------------
    # 11. Display Borrowing History
    # ---------------------------------------------------------
    def display_borrowing_history(self, limit=30):
        try:
            txns = list(self.db.transactions.find({}, {"_id": 0}).sort("issueDate", -1).limit(limit))
            if not txns:
                print("\n[-] No borrowing transactions recorded yet.")
                return

            table_data = []
            for t in txns:
                table_data.append([
                    t.get("transactionId"),
                    t.get("bookId"),
                    t.get("bookTitle", "-")[:25],
                    t.get("memberId"),
                    t.get("status"),
                    t.get("issueDate", "-")[:19],
                    (t.get("returnDate") or "-")[:19]
                ])

            headers = ["Txn ID", "Book ID", "Title", "Member ID", "Status", "Issue Date", "Return Date"]
            print(f"\n=== Library Borrowing History (Recent {len(txns)}) ===")
            print(tabulate(table_data, headers=headers, tablefmt="grid"))
        except Exception as e:
            print(f"[!] Error fetching history: {e}")
