import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Send,
  Layers,
  RotateCcw,
} from 'lucide-react';
import type { Book } from '../types';
import { apiGet, apiPost, apiPut, apiDelete } from '../api';
import { useToast } from '../context/ToastContext';

export const BooksPage: React.FC = () => {
  const [books, setBooks] = useState<Book[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [search, setSearch] = useState('');
  const [field, setField] = useState('title');
  const [loading, setLoading] = useState(false);

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  // Form states
  const [formBookId, setFormBookId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formAuthor, setFormAuthor] = useState('');
  const [formCategory, setFormCategory] = useState('Computer Science');
  const [formCopies, setFormCopies] = useState(5);
  const [issueMemberId, setIssueMemberId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { showToast } = useToast();

  const fetchBooks = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (search.trim()) {
        q.append('search', search.trim());
        q.append('field', field);
      }
      const res = await apiGet(`/books?${q.toString()}`);
      setBooks(res.books || []);
      setTotal(res.total || 0);
    } catch (e: any) {
      showToast(e.message || 'Error loading books', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, field, showToast]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchBooks();
  };

  const openAddModal = () => {
    setFormBookId(`BK-${Math.floor(1000 + Math.random() * 9000)}`);
    setFormTitle('');
    setFormAuthor('');
    setFormCategory('Computer Science');
    setFormCopies(5);
    setAddModalOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiPost('/books', {
        bookId: formBookId.trim(),
        title: formTitle.trim(),
        author: formAuthor.trim(),
        category: formCategory.trim(),
        totalCopies: Number(formCopies),
      });
      if (res.success) {
        showToast(res.message, 'success');
        setAddModalOpen(false);
        fetchBooks();
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (book: Book) => {
    setSelectedBook(book);
    setFormTitle(book.title);
    setFormAuthor(book.author);
    setFormCategory(book.category);
    setFormCopies(book.totalCopies);
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBook) return;
    setSubmitting(true);
    try {
      const res = await apiPut(`/books/${selectedBook.bookId}`, {
        title: formTitle.trim(),
        author: formAuthor.trim(),
        category: formCategory.trim(),
        totalCopies: Number(formCopies),
      });
      if (res.success) {
        showToast(res.message, 'success');
        setEditModalOpen(false);
        fetchBooks();
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (book: Book) => {
    if (
      !confirm(
        `Are you sure you want to delete "${book.title}" (${book.bookId})?`
      )
    ) {
      return;
    }
    try {
      const res = await apiDelete(`/books/${book.bookId}`);
      if (res.success) {
        showToast(res.message, 'success');
        fetchBooks();
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const openDetailModal = async (book: Book) => {
    try {
      const res = await apiGet(`/books/${book.bookId}`);
      if (res.book) {
        setSelectedBook(res.book);
        setDetailModalOpen(true);
      }
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const openQuickIssue = (book: Book) => {
    setSelectedBook(book);
    setIssueMemberId('');
    setIssueModalOpen(true);
  };

  const handleQuickIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBook || !issueMemberId.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiPost('/books/issue', {
        bookId: selectedBook.bookId,
        memberId: issueMemberId.trim(),
      });
      if (res.success) {
        showToast(res.message, 'success');
        setIssueModalOpen(false);
        setIssueMemberId('');
        fetchBooks();
        if (detailModalOpen) {
          openDetailModal(selectedBook);
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

  const handleQuickReturn = async (transactionId: string) => {
    setSubmitting(true);
    try {
      const res = await apiPost('/books/return', { transactionId });
      if (res.success) {
        showToast(res.message, 'success');
        fetchBooks();
        if (selectedBook) {
          openDetailModal(selectedBook);
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
          <h2>Book Catalog Management</h2>
          <p>
            Manage library documents, stock availability, and shard-key mapped collections.
          </p>
        </div>
        <button onClick={openAddModal} className="btn btn-primary">
          <Plus className="w-4 h-4" />
          <span>Add New Book</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="card">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[240px] relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search books..."
              className="form-input pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="form-input w-40"
            value={field}
            onChange={(e) => setField(e.target.value)}
          >
            <option value="title">Title</option>
            <option value="author">Author</option>
            <option value="category">Category (Shard Key)</option>
            <option value="bookId">Book ID</option>
          </select>

          <button type="submit" className="btn btn-primary">
            Filter
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

      {/* Books Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            Books ({total} Total Records)
          </span>
          <div className="text-xs text-[var(--text-muted)]">
            Page {page} of {totalPages}
          </div>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-[var(--text-muted)]">
            <div className="loading-spinner mb-2" />
            <div>Loading book catalog...</div>
          </div>
        ) : books.length === 0 ? (
          <div className="empty-state">
            <BookOpen className="w-10 h-10 mx-auto" />
            <p>No books found matching criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Book ID</th>
                  <th>Title</th>
                  <th>Author</th>
                  <th>Category (Shard Key)</th>
                  <th>Available / Total</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {books.map((b) => {
                  const isAvailable = b.availableCopies > 0;
                  return (
                    <tr key={b.bookId}>
                      <td className="font-mono text-xs font-semibold text-[var(--accent-primary)]">
                        {b.bookId}
                      </td>
                      <td className="font-medium text-[var(--text-primary)] max-w-xs truncate">
                        {b.title}
                      </td>
                      <td className="text-[var(--text-secondary)]">{b.author}</td>
                      <td>
                        <span className="badge badge-blue">{b.category}</span>
                      </td>
                      <td className="font-mono text-xs">
                        <span
                          className={
                            isAvailable
                              ? 'text-[var(--accent-green)] font-bold'
                              : 'text-[var(--accent-red)] font-bold'
                          }
                        >
                          {b.availableCopies}
                        </span>{' '}
                        / {b.totalCopies}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            isAvailable ? 'badge-green' : 'badge-red'
                          }`}
                        >
                          {isAvailable ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </td>
                      <td className="text-right space-x-1.5 whitespace-nowrap">
                        {isAvailable && (
                          <button
                            onClick={() => openQuickIssue(b)}
                            className="btn btn-sm border-[var(--accent-primary)] text-[var(--accent-primary)] hover:bg-[var(--bg-hover)]"
                            title="Quick Issue to Member"
                          >
                            <Send className="w-3 h-3 mr-1" />
                            Issue
                          </button>
                        )}
                        <button
                          onClick={() => openDetailModal(b)}
                          className="btn btn-sm"
                          title="View Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(b)}
                          className="btn btn-sm"
                          title="Edit Book"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                        </button>
                        <button
                          onClick={() => handleDelete(b)}
                          className="btn btn-sm btn-danger"
                          title="Delete Book"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
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

      {/* Add Book Modal */}
      {addModalOpen && (
        <div className="modal-overlay" onClick={() => setAddModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Add New Book to Distributed DB</h3>
            <form onSubmit={handleAddSubmit}>
              <div className="form-group">
                <label className="form-label">Book ID (Unique Identifier)</label>
                <input
                  type="text"
                  required
                  className="form-input font-mono"
                  value={formBookId}
                  onChange={(e) => setFormBookId(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Designing Data-Intensive Applications"
                  className="form-input"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Author</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Martin Kleppmann"
                  className="form-input"
                  value={formAuthor}
                  onChange={(e) => setFormAuthor(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Category (Compound Shard Key Prefix)</label>
                <select
                  className="form-input"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                >
                  <option value="Computer Science">Computer Science</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Physics">Physics</option>
                  <option value="Literature">Literature</option>
                  <option value="History">History</option>
                  <option value="Philosophy">Philosophy</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Total Copies</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  className="form-input"
                  value={formCopies}
                  onChange={(e) => setFormCopies(Number(e.target.value))}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setAddModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  {submitting ? 'Adding...' : 'Add Book'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Book Modal */}
      {editModalOpen && selectedBook && (
        <div className="modal-overlay" onClick={() => setEditModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Edit Book: {selectedBook.bookId}</h3>
            <form onSubmit={handleEditSubmit}>
              <div className="form-group">
                <label className="form-label">Title</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Author</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={formAuthor}
                  onChange={(e) => setFormAuthor(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-input"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                >
                  <option value="Computer Science">Computer Science</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Physics">Physics</option>
                  <option value="Literature">Literature</option>
                  <option value="History">History</option>
                  <option value="Philosophy">Philosophy</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Total Copies</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  required
                  className="form-input"
                  value={formCopies}
                  onChange={(e) => setFormCopies(Number(e.target.value))}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Issue Modal */}
      {issueModalOpen && selectedBook && (
        <div className="modal-overlay" onClick={() => setIssueModalOpen(false)}>
          <div className="modal max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title flex items-center justify-between">
              <span className="font-serif">Issue Book</span>
              <span className="badge badge-blue font-mono">{selectedBook.bookId}</span>
            </h3>

            <div className="p-3 bg-[var(--bg-primary)] rounded border border-[var(--border)] text-xs mb-4 space-y-1">
              <div className="font-semibold text-[var(--text-primary)] font-serif">{selectedBook.title}</div>
              <div className="text-[var(--text-secondary)]">by {selectedBook.author} • {selectedBook.category}</div>
              <div className="text-[var(--status-success)] font-mono mt-1 font-medium">
                ✓ {selectedBook.availableCopies} of {selectedBook.totalCopies} copies in stock
              </div>
            </div>

            <form onSubmit={handleQuickIssueSubmit} className="space-y-4">
              <div className="form-group">
                <label className="form-label">Member ID to Borrow</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. MEM-001 or MEM-101"
                  className="form-input font-mono"
                  value={issueMemberId}
                  onChange={(e) => setIssueMemberId(e.target.value)}
                />
                <span className="text-[11px] text-[var(--text-muted)] block mt-1">
                  14-day standard loan period will be stamped upon atomic confirmation.
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
                  {submitting ? 'Confirming Issue...' : 'Confirm Checkout'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal with Active Issues & Return Action */}
      {detailModalOpen && selectedBook && (
        <div className="modal-overlay" onClick={() => setDetailModalOpen(false)}>
          <div className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title flex items-center justify-between">
              <span className="truncate max-w-[320px] font-serif">{selectedBook.title}</span>
              <span className="badge badge-blue font-mono">
                {selectedBook.bookId}
              </span>
            </h3>

            <div className="space-y-3 mb-4 text-xs">
              <div className="grid-2 p-3 bg-[var(--bg-primary)] rounded border border-[var(--border)]">
                <div>
                  <span className="text-[var(--text-secondary)]">Author:</span>
                  <div className="font-semibold text-[var(--text-primary)] mt-0.5">
                    {selectedBook.author}
                  </div>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)]">Category & Shard Key:</span>
                  <div className="font-semibold text-[var(--accent-primary)] mt-0.5 flex items-center gap-1 font-mono">
                    <Layers className="w-3.5 h-3.5" />
                    {selectedBook.category}
                  </div>
                </div>
              </div>

              <div className="grid-2 p-3 bg-[var(--bg-primary)] rounded border border-[var(--border)]">
                <div>
                  <span className="text-[var(--text-secondary)]">Current Availability:</span>
                  <div className="font-semibold text-[var(--status-success)] mt-0.5">
                    {selectedBook.availableCopies} available
                  </div>
                </div>
                <div>
                  <span className="text-[var(--text-secondary)]">Total Catalog Copies:</span>
                  <div className="font-semibold text-[var(--text-primary)] mt-0.5">
                    {selectedBook.totalCopies} copies registered
                  </div>
                </div>
              </div>

              {/* Active Issues with Quick Return */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-xs text-[var(--text-primary)] font-serif">
                    Active Borrowers ({selectedBook.activeIssues?.length || 0})
                  </h4>
                  {selectedBook.availableCopies > 0 && (
                    <button
                      onClick={() => {
                        setDetailModalOpen(false);
                        openQuickIssue(selectedBook);
                      }}
                      className="text-[11px] text-[var(--accent-primary)] hover:underline flex items-center gap-1 font-medium"
                    >
                      <Send className="w-3 h-3" /> Issue Copy
                    </button>
                  )}
                </div>

                {selectedBook.activeIssues && selectedBook.activeIssues.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedBook.activeIssues.map((issue) => (
                      <div
                        key={issue.transactionId}
                        className="p-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="font-mono font-bold text-[var(--accent-primary)]">
                            {issue.memberId}
                          </div>
                          <div className="text-[11px] text-[var(--text-secondary)]">
                            Issued: {new Date(issue.issueDate).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="badge badge-yellow">LOANED</span>
                          <button
                            disabled={submitting}
                            onClick={() => handleQuickReturn(issue.transactionId)}
                            className="btn btn-sm border-[var(--status-success)]/40 text-[var(--status-success)] hover:bg-[var(--status-success)]/10 py-1 text-[11px]"
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Return
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[var(--text-secondary)] py-2 text-center bg-[var(--bg-primary)] rounded border border-[var(--border)]">
                    No active loans for this title. All copies are currently available in the stacks.
                  </p>
                )}
              </div>
            </div>

            <div className="modal-actions">
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
    </div>
  );
};
