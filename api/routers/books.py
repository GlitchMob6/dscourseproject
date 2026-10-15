"""
Books CRUD router — wraps LibraryService for HTTP access.
"""

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from typing import Optional
from app.library_operations import LibraryService

router = APIRouter()


class BookCreate(BaseModel):
    bookId: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    author: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1)
    totalCopies: int = Field(..., gt=0)


class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    category: Optional[str] = None
    totalCopies: Optional[int] = None


def _get_service():
    return LibraryService()


@router.get("")
def list_books(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
    field: Optional[str] = None,
):
    """List books with pagination and optional search."""
    svc = _get_service()
    db = svc.db

    mongo_filter = {}
    if search and field:
        field_map = {"bookId": "bookId", "title": "title", "author": "author", "category": "category"}
        mongo_field = field_map.get(field, "title")
        if mongo_field == "bookId":
            mongo_filter = {"bookId": search.strip()}
        else:
            mongo_filter = {mongo_field: {"$regex": search.strip(), "$options": "i"}}
    elif search:
        mongo_filter = {
            "$or": [
                {"title": {"$regex": search.strip(), "$options": "i"}},
                {"author": {"$regex": search.strip(), "$options": "i"}},
                {"category": {"$regex": search.strip(), "$options": "i"}},
                {"bookId": search.strip()},
            ]
        }

    try:
        total = db.books.count_documents(mongo_filter)
        skip = (page - 1) * limit
        books = list(db.books.find(mongo_filter, {"_id": 0}).skip(skip).limit(limit))
        return {"books": books, "total": total, "page": page, "limit": limit}
    except Exception as e:
        return {"books": [], "total": 0, "error": str(e)}


@router.get("/{book_id}")
def get_book(book_id: str):
    """Get a single book by ID."""
    svc = _get_service()
    try:
        book = svc.db.books.find_one({"bookId": book_id.strip()}, {"_id": 0})
        if book:
            # Include active issues for this book
            issues = list(svc.db.transactions.find(
                {"bookId": book_id.strip(), "status": "ISSUED"}, {"_id": 0}
            ))
            book["activeIssues"] = issues
            return {"book": book}
        return {"book": None, "error": f"Book '{book_id}' not found."}
    except Exception as e:
        return {"book": None, "error": str(e)}


@router.post("")
def add_book(body: BookCreate):
    """Add a new book."""
    svc = _get_service()
    success, msg = svc.add_book(body.bookId, body.title, body.author, body.category, body.totalCopies)
    return {"success": success, "message": msg}


@router.put("/{book_id}")
def update_book(book_id: str, body: BookUpdate):
    """Update an existing book."""
    svc = _get_service()
    success, msg = svc.update_book(book_id, body.title, body.author, body.category, body.totalCopies)
    return {"success": success, "message": msg}


@router.delete("/{book_id}")
def delete_book(book_id: str):
    """Delete a book (blocked if copies are issued)."""
    svc = _get_service()
    success, msg = svc.delete_book(book_id)
    return {"success": success, "message": msg}


class IssueRequest(BaseModel):
    bookId: str
    memberId: str


@router.post("/issue")
def issue_book(body: IssueRequest):
    """Issue a book to a member (atomic availability decrement)."""
    svc = _get_service()
    success, msg = svc.issue_book(body.bookId, body.memberId)
    return {"success": success, "message": msg}


class ReturnRequest(BaseModel):
    transactionId: Optional[str] = None
    bookId: Optional[str] = None
    memberId: Optional[str] = None


@router.post("/return")
def return_book(body: ReturnRequest):
    """Return a book (atomic availability restore)."""
    svc = _get_service()
    identifier = body.transactionId or body.bookId
    if not identifier:
        return {"success": False, "message": "Provide transactionId or bookId."}
    success, msg = svc.return_book(identifier, body.memberId)
    return {"success": success, "message": msg}


@router.get("/transactions/history")
def transaction_history(limit: int = Query(50, ge=1, le=500)):
    """Get borrowing history."""
    svc = _get_service()
    try:
        txns = list(svc.db.transactions.find({}, {"_id": 0}).sort("issueDate", -1).limit(limit))
        return {"transactions": txns, "total": len(txns)}
    except Exception as e:
        return {"transactions": [], "error": str(e)}
