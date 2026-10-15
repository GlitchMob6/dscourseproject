import React, { useState, useEffect, useCallback } from 'react';
import {
  Repeat,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import type { Transaction } from '../types';
import { apiGet, apiPost } from '../api';
import { useToast } from '../context/ToastContext';

export const TransactionsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Issue Form
  const [issueBookId, setIssueBookId] = useState('');
  const [issueMemberId, setIssueMemberId] = useState('');
  const [issuing, setIssuing] = useState(false);

  // Return Form
  const [returnId, setReturnId] = useState('');
  const [returning, setReturning] = useState(false);

  const { showToast } = useToast();

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet('/books/transactions/history?limit=100');
      setTransactions(res.transactions || []);
    } catch (e: any) {
      showToast(e.message || 'Error loading transactions', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!issueBookId.trim() || !issueMemberId.trim()) return;
    setIssuing(true);
    try {
      const res = await apiPost('/books/issue', {
        bookId: issueBookId.trim(),
        memberId: issueMemberId.trim(),
      });
      if (res.success) {
        showToast(res.message, 'success');
        setIssueBookId('');
        fetchTransactions();
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIssuing(false);
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnId.trim()) return;
    setReturning(true);
    try {
      // Determine if it looks like a TXN- or a BK-
      const payload = returnId.trim().startsWith('TXN-')
        ? { transactionId: returnId.trim() }
        : { bookId: returnId.trim() };

      const res = await apiPost('/books/return', payload);
      if (res.success) {
        showToast(res.message, 'success');
        setReturnId('');
        fetchTransactions();
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setReturning(false);
    }
  };

  const filteredTxns = transactions.filter((t) => {
    if (filterStatus === 'ALL') return true;
    return t.status === filterStatus;
  });

  return (
    <div className="space-y-8">
      <div className="page-header">
        <h2>Circulation & Transactions</h2>
        <p>
          Execute atomic book checkouts and returns with consistency guarantees across MongoDB topologies.
        </p>
      </div>

      {/* Side-by-side Action Panels: Issue vs Return */}
      <div className="grid-2">
        {/* Issue Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title flex items-center gap-2 text-cyan-400">
              <ArrowUpRight className="w-4 h-4" />
              Issue Book (Checkout)
            </span>
            <span className="text-[11px] text-[var(--text-muted)] font-mono">
              $inc: -1 availableCopies
            </span>
          </div>

          <form onSubmit={handleIssueSubmit} className="space-y-3">
            <div className="form-group">
              <label className="form-label">Book ID</label>
              <input
                type="text"
                required
                placeholder="e.g. BK-00001"
                className="form-input font-mono"
                value={issueBookId}
                onChange={(e) => setIssueBookId(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Member ID</label>
              <input
                type="text"
                required
                placeholder="e.g. MEM-001"
                className="form-input font-mono"
                value={issueMemberId}
                onChange={(e) => setIssueMemberId(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={issuing}
              className="btn btn-primary w-full justify-center"
            >
              {issuing ? 'Executing Atomic Issue...' : 'Confirm Book Issue'}
            </button>
          </form>
        </div>

        {/* Return Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-title flex items-center gap-2 text-emerald-400">
              <ArrowDownLeft className="w-4 h-4" />
              Return Book (Check-in)
            </span>
            <span className="text-[11px] text-[var(--text-muted)] font-mono">
              $inc: +1 availableCopies
            </span>
          </div>

          <form onSubmit={handleReturnSubmit} className="space-y-3">
            <div className="form-group">
              <label className="form-label">
                Transaction ID or Book ID
              </label>
              <input
                type="text"
                required
                placeholder="e.g. TXN-XXXXXX or BK-00001"
                className="form-input font-mono"
                value={returnId}
                onChange={(e) => setReturnId(e.target.value)}
              />
              <span className="text-[11px] text-[var(--text-muted)] mt-1 block">
                You can enter either the specific Transaction ID or the Book ID to return.
              </span>
            </div>

            <div className="pt-7">
              <button
                type="submit"
                disabled={returning}
                className="btn w-full justify-center border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
              >
                {returning ? 'Processing Return...' : 'Confirm Book Return'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Transaction History Card */}
      <div className="card">
        <div className="card-header">
          <span className="card-title flex items-center gap-2">
            <Repeat className="w-4 h-4 text-cyan-400" />
            Audit Ledger ({filteredTxns.length} Records)
          </span>

          <div className="flex items-center gap-2">
            <div className="tabs mb-0">
              <button
                className={`tab ${filterStatus === 'ALL' ? 'active' : ''}`}
                onClick={() => setFilterStatus('ALL')}
              >
                All
              </button>
              <button
                className={`tab ${filterStatus === 'ISSUED' ? 'active' : ''}`}
                onClick={() => setFilterStatus('ISSUED')}
              >
                Issued
              </button>
              <button
                className={`tab ${filterStatus === 'RETURNED' ? 'active' : ''}`}
                onClick={() => setFilterStatus('RETURNED')}
              >
                Returned
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-[var(--text-muted)]">
            <div className="loading-spinner mb-2" />
            <div>Loading transactions...</div>
          </div>
        ) : filteredTxns.length === 0 ? (
          <div className="empty-state">
            <Clock className="w-10 h-10 mx-auto" />
            <p>No transactions match the selected filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Book Title & ID</th>
                  <th>Member</th>
                  <th>Issued Date</th>
                  <th>Due Date / Returned</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredTxns.map((t) => {
                  const issueTime = new Date(t.issueDate).getTime();
                  const dueDate = new Date(issueTime + 14 * 24 * 60 * 60 * 1000);
                  const isOverdue = t.status === 'ISSUED' && Date.now() > dueDate.getTime();

                  return (
                    <tr key={t.transactionId}>
                      <td className="font-mono text-xs font-semibold text-cyan-400">
                        {t.transactionId}
                      </td>
                      <td>
                        <div className="font-medium text-white max-w-[200px] truncate">
                          {(t as any).bookTitle || t.bookId}
                        </div>
                        <div className="text-[11px] font-mono text-[var(--text-muted)]">
                          {t.bookId}
                        </div>
                      </td>
                      <td>
                        <div className="text-slate-200">
                          {(t as any).memberName || t.memberId}
                        </div>
                        <div className="text-[11px] font-mono text-[var(--text-muted)]">
                          {t.memberId}
                        </div>
                      </td>
                      <td className="text-xs text-slate-300">
                        {new Date(t.issueDate).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                        <div className="text-[10px] text-[var(--text-muted)]">
                          {new Date(t.issueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="text-xs">
                        {t.status === 'RETURNED' && t.returnDate ? (
                          <div className="text-slate-300">
                            {new Date(t.returnDate).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                            <div className="text-[10px] text-emerald-400/80">Returned in good standing</div>
                          </div>
                        ) : (
                          <div>
                            <span className={isOverdue ? 'text-rose-400 font-semibold' : 'text-slate-300'}>
                              {dueDate.toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                            <div className={`text-[10px] ${isOverdue ? 'text-rose-400 font-bold' : 'text-[var(--text-muted)]'}`}>
                              {isOverdue ? '⚠ Overdue (14-day loan)' : '14-day loan standard'}
                            </div>
                          </div>
                        )}
                      </td>
                      <td>
                        {t.status === 'RETURNED' ? (
                          <span className="badge badge-green font-semibold">RETURNED</span>
                        ) : isOverdue ? (
                          <span className="badge badge-red font-bold">OVERDUE</span>
                        ) : (
                          <span className="badge badge-yellow font-bold">ACTIVE LOAN</span>
                        )}
                      </td>
                    <td className="text-right">
                      {t.status === 'ISSUED' && (
                        <button
                          onClick={async () => {
                            setReturning(true);
                            try {
                              const res = await apiPost('/books/return', {
                                transactionId: t.transactionId,
                              });
                              if (res.success) {
                                showToast(res.message, 'success');
                                fetchTransactions();
                              } else {
                                showToast(res.message, 'error');
                              }
                            } catch (e: any) {
                              showToast(e.message, 'error');
                            } finally {
                              setReturning(false);
                            }
                          }}
                          className="btn btn-sm border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                        >
                          Quick Return
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Architectural Guarantee Information */}
      <div className="info-panel flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div>
          <h4>Concurrency & Atomicity Guarantees</h4>
          <p>
            In MongoDB, single-document updates are strictly atomic. The library service uses conditional filters{' '}
            <code>{`{ "bookId": id, "availableCopies": { "$gt": 0 } }`}</code> paired with{' '}
            <code>{`{ "$inc": { "availableCopies": -1 } }`}</code> to guarantee that two concurrent checkout requests
            can never over-allocate a book copy. On a replica set, these write events are logged in the primary's oplog and
            streamed to secondaries according to the configured Write Concern.
          </p>
        </div>
      </div>
    </div>
  );
};
