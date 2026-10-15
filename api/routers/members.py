"""
Members router — register, list, and search members.
"""

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field
from typing import Optional
from app.library_operations import LibraryService

router = APIRouter()


class MemberCreate(BaseModel):
    memberId: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1)
    department: str = Field(..., min_length=1)


def _get_service():
    return LibraryService()


@router.get("")
def list_members(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=200),
    search: Optional[str] = None,
):
    """List all members with optional search."""
    svc = _get_service()
    db = svc.db

    mongo_filter = {}
    if search:
        mongo_filter = {
            "$or": [
                {"memberId": search.strip()},
                {"name": {"$regex": search.strip(), "$options": "i"}},
                {"department": {"$regex": search.strip(), "$options": "i"}},
            ]
        }

    try:
        total = db.members.count_documents(mongo_filter)
        skip = (page - 1) * limit
        members = list(db.members.find(mongo_filter, {"_id": 0}).skip(skip).limit(limit))
        # Attach borrow counts
        for m in members:
            m["activeIssues"] = db.transactions.count_documents(
                {"memberId": m["memberId"], "status": "ISSUED"}
            )
        return {"members": members, "total": total, "page": page, "limit": limit}
    except Exception as e:
        return {"members": [], "total": 0, "error": str(e)}


@router.get("/{member_id}")
def get_member(member_id: str):
    """Get a member and their borrowing history."""
    svc = _get_service()
    db = svc.db
    try:
        member = db.members.find_one({"memberId": member_id.strip()}, {"_id": 0})
        if not member:
            return {"member": None, "error": f"Member '{member_id}' not found."}
        history = list(
            db.transactions.find({"memberId": member_id.strip()}, {"_id": 0}).sort("issueDate", -1).limit(50)
        )
        member["history"] = history
        member["activeIssues"] = sum(1 for t in history if t.get("status") == "ISSUED")
        return {"member": member}
    except Exception as e:
        return {"member": None, "error": str(e)}


@router.post("")
def register_member(body: MemberCreate):
    """Register a new library member."""
    svc = _get_service()
    success, msg = svc.register_member(body.memberId, body.name, body.department)
    return {"success": success, "message": msg}
