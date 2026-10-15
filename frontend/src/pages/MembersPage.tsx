import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  Send,
  RotateCcw,
} from 'lucide-react';
import type { Member } from '../types';
import { apiGet, apiPost } from '../api';
import { useToast } from '../context/ToastContext';

export const MembersPage: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Modals
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  // Form
  const [formMemberId, setFormMemberId] = useState('');
  const [formName, setFormName] = useState('');
  const [formDept, setFormDept] = useState('Computer Science');
  const [issueBookId, setIssueBookId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { showToast } = useToast();

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search.trim()) {
        q.append('search', search.trim());
      }
      const res = await apiGet(`/members?${q.toString()}`);
      setMembers(res.members || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      showToast(e.message || 'Error loading members', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, showToast]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchMembers();
  };

  const openRegisterModal = () => {
    setFormMemberId(`MEM-${Math.floor(100 + Math.random() * 900)}`);
    setFormName('');
    setFormDept('Computer Science');
    setRegisterModalOpen(true);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiPost('/members', {
        memberId: formMemberId.trim(),
        name: formName.trim(),
        department: formDept.trim(),
      });
      if (res.success) {
        showToast(res.message, 'success');
        setRegisterModalOpen(false);
        fetchMembers();
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openDetailModal = async (member: Member) => {
    try {
      const res = await apiGet(`/members/${member.memberId}`);
      if (res.member) {
        setSelectedMember(res.member);
        setDetailModalOpen(true);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const openIssueForMember = (member: Member) => {
    setSelectedMember(member);
    setIssueBookId('');
    setIssueModalOpen(true);
  };

  const handleMemberIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember || !issueBookId.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiPost('/books/issue', {
        bookId: issueBookId.trim(),
        memberId: selectedMember.memberId,
      });
      if (res.success) {
        showToast(res.message, 'success');
        setIssueModalOpen(false);
        setIssueBookId('');
        fetchMembers();
        if (detailModalOpen) {
          openDetailModal(selectedMember);
        }
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMemberReturn = async (transactionId: string) => {
    setSubmitting(true);
    try {
      const res = await apiPost('/books/return', { transactionId });
      if (res.success) {
        showToast(res.message, 'success');
        fetchMembers();
        if (selectedMember) {
          openDetailModal(selectedMember);
        }
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-8">
      <div className="page-header flex items-center justify-between">
        <div>
          <h2>Member Registry</h2>
          <p>
            Manage student & faculty cardholders, track borrowing history, and enforce loan quotas.
          </p>
        </div>
        <button onClick={openRegisterModal} className="btn btn-primary">
          <UserPlus className="w-4 h-4" />
          <span>Register Member</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="card">
        <form onSubmit={handleSearchSubmit} className="flex gap-3 items-center">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search by Member ID, name, or department..."
              className="form-input pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary">
            Search
          </button>
          {search && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {/* Members Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            Registered Members ({total} Total)
          </span>
          <div className="text-xs text-[var(--text-muted)]">
            Page {page} of {totalPages}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-[var(--text-muted)]">
            <div className="loading-spinner mb-2" />
            <div>Loading members...</div>
          </div>
        ) : members.length === 0 ? (
          <div className="empty-state">
            <Users className="w-10 h-10 mx-auto" />
            <p>No members registered yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Member ID</th>
                  <th>Full Name</th>
                  <th>Department</th>
                  <th>Active Loans</th>
                  <th>Registration Date</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.memberId}>
                    <td className="font-mono text-xs font-semibold text-cyan-400">
                      {m.memberId}
                    </td>
                    <td className="font-medium text-white">{m.name}</td>
                    <td>
                      <span className="badge badge-purple">{m.department}</span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span
                          className={`badge ${
                            (m.activeIssues || 0) >= 5
                              ? 'badge-red font-bold'
                              : (m.activeIssues || 0) > 0
                              ? 'badge-yellow font-bold'
                              : 'badge-blue'
                          }`}
                        >
                          {m.activeIssues || 0} / 5 books
                        </span>
                      </div>
                    </td>
                    <td className="text-xs text-slate-400">
                      {m.registeredAt
                        ? new Date(m.registeredAt).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => openIssueForMember(m)}
                        className="btn btn-sm border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10"
                        title="Issue Book to this Member"
                      >
                        <Send className="w-3 h-3 mr-1" />
                        Issue Book
                      </button>
                      <button
                        onClick={() => openDetailModal(m)}
                        className="btn btn-sm"
                        title="View Loan History"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        History
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-[var(--border)]">
          <div className="text-xs text-[var(--text-muted)]">
            Showing {(page - 1) * limit + 1} -{' '}
            {Math.min(page * limit, total)} of {total}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </button>
            <button
              className="btn btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Register Modal */}
      {registerModalOpen && (
        <div
          className="modal-overlay"
          onClick={() => setRegisterModalOpen(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Register New Member</h3>
            <form onSubmit={handleRegisterSubmit}>
              <div className="form-group">
                <label className="form-label">Member ID</label>
                <input
                  type="text"
                  required
                  className="form-input font-mono"
                  value={formMemberId}
                  onChange={(e) => setFormMemberId(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Alan Turing"
                  className="form-input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Department</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Computer Science"
                  className="form-input"
                  value={formDept}
                  onChange={(e) => setFormDept(e.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setRegisterModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  {submitting ? 'Registering...' : 'Register Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Member Details & History Modal */}
      {detailModalOpen && selectedMember && (
        <div
          className="modal-overlay"
          onClick={() => setDetailModalOpen(false)}
        >
          <div className="modal max-w-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title flex items-center justify-between">
              <span>{selectedMember.name}</span>
              <span className="badge badge-purple font-mono">
                {selectedMember.memberId}
              </span>
            </h3>

            <div className="p-3 bg-[var(--bg-primary)] rounded border border-[var(--border)] text-xs mb-4 flex justify-between">
              <div>
                <span className="text-[var(--text-muted)]">Department:</span>
                <span className="ml-2 font-semibold text-white">
                  {selectedMember.department}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Active Borrowed:</span>
                <span className="ml-2 font-semibold text-amber-400">
                  {selectedMember.activeIssues || 0} books
                </span>
              </div>
            </div>

            <h4 className="font-semibold text-xs text-white mb-2">
              Circulation History ({selectedMember.history?.length || 0})
            </h4>

            {selectedMember.history && selectedMember.history.length > 0 ? (
              <div className="max-h-60 overflow-y-auto space-y-2">
                {selectedMember.history.map((t) => (
                  <div
                    key={t.transactionId}
                    className="p-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-mono font-bold text-cyan-400">
                        {t.bookId}
                      </div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        Issued: {new Date(t.issueDate).toLocaleDateString()}
                        {t.returnDate &&
                          ` • Returned: ${new Date(t.returnDate).toLocaleDateString()}`}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`badge ${
                          t.status === 'ISSUED' ? 'badge-yellow font-semibold' : 'badge-green'
                        }`}
                      >
                        {t.status}
                      </span>
                      {t.status === 'ISSUED' && (
                        <button
                          disabled={submitting}
                          onClick={() => handleMemberReturn(t.transactionId)}
                          className="btn btn-sm border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 py-1 text-[11px]"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Return
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)] py-4 text-center">
                No circulation history found for this member.
              </p>
            )}

            <div className="modal-actions mt-4">
              <button
                className="btn btn-sm border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/10"
                onClick={() => {
                  setDetailModalOpen(false);
                  openIssueForMember(selectedMember);
                }}
              >
                <Send className="w-3 h-3 mr-1" />
                Issue Book to Member
              </button>
              <button
                className="btn btn-sm"
                onClick={() => setDetailModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Issue Book Modal */}
      {issueModalOpen && selectedMember && (
        <div className="modal-overlay" onClick={() => setIssueModalOpen(false)}>
          <div className="modal max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title flex items-center justify-between">
              <span>Issue Book to Member</span>
              <span className="badge badge-purple font-mono">{selectedMember.memberId}</span>
            </h3>

            <div className="p-3 bg-[var(--bg-primary)] rounded border border-[var(--border)] text-xs mb-4 space-y-1">
              <div className="font-semibold text-white">{selectedMember.name}</div>
              <div className="text-[var(--text-muted)]">{selectedMember.department}</div>
              <div className="text-amber-400 font-mono mt-1">
                Current active loans: {selectedMember.activeIssues || 0} of 5 quota
              </div>
            </div>

            <form onSubmit={handleMemberIssueSubmit} className="space-y-4">
              <div className="form-group">
                <label className="form-label">Book ID to Checkout</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. BK-00001"
                  className="form-input font-mono"
                  value={issueBookId}
                  onChange={(e) => setIssueBookId(e.target.value)}
                />
                <span className="text-[11px] text-[var(--text-muted)] block mt-1">
                  Enforces atomic availability decrement on the active MongoDB replica/shard.
                </span>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setIssueModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  {submitting ? 'Confirming...' : 'Confirm Checkout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
