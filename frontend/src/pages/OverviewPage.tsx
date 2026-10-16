import React, { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import {
  BookOpen,
  Users,
  Repeat,
  Layers,
  Server,
  ArrowRight,
  ShieldCheck,
  Zap,
  HardDrive,
  Activity,
} from 'lucide-react';
import type { HealthStatus, Transaction } from '../types';
import { apiGet } from '../api';

interface ContextType {
  health: HealthStatus | null;
  refreshHealth: () => void;
}

export const OverviewPage: React.FC = () => {
  const { health } = useOutletContext<ContextType>();
  const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
  const [loadingTxns, setLoadingTxns] = useState(false);

  useEffect(() => {
    const fetchRecent = async () => {
      setLoadingTxns(true);
      try {
        const res = await apiGet('/health/recent-transactions');
        setRecentTxns(res.transactions || []);
      } catch {
        setRecentTxns([]);
      } finally {
        setLoadingTxns(false);
      }
    };
    fetchRecent();
  }, []);

  return (
    <div className="space-y-8">
      <div className="page-header">
        <h2>Library Systems Dashboard</h2>
        <p>
          Live operational view of the distributed MongoDB library cluster — catalog stats, topology health, and quick access to experiments.
        </p>
      </div>

      {/* Top Stats Grid */}
      <div className="grid-4">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Catalog Size</span>
            <BookOpen className="w-5 h-5 text-[var(--accent-primary)]" />
          </div>
          <div className="stat-value">{health?.stats?.books ?? '—'}</div>
          <div className="stat-label">Total Books in library_db</div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Registered Members</span>
            <Users className="w-5 h-5 text-[var(--accent-green)]" />
          </div>
          <div className="stat-value">{health?.stats?.members ?? '—'}</div>
          <div className="stat-label">Active library cardholders</div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Total Circulation</span>
            <Repeat className="w-5 h-5 text-[var(--accent-secondary)]" />
          </div>
          <div className="stat-value">{health?.stats?.transactions ?? '—'}</div>
          <div className="stat-label">Lifetime borrow/return events</div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Active Issues</span>
            <Zap className="w-5 h-5 text-[var(--accent-gold-dark)]" />
          </div>
          <div className="stat-value text-[var(--accent-gold-dark)]">
            {health?.stats?.active_issues ?? '—'}
          </div>
          <div className="stat-label">Books currently checked out</div>
        </div>
      </div>

      {/* Active Cluster State Card & Quick Links */}
      <div className="grid-3 gap-6 items-stretch">
        {/* Active Topology Overview */}
        <div className="card col-span-2 flex flex-col justify-between p-7">
          <div>
            <div className="card-header mb-5">
              <span className="card-title flex items-center gap-2.5 font-serif text-sm">
                <Server className="w-4 h-4 text-[var(--accent-primary)]" />
                Active Database Topology
              </span>
              <span
                className={`badge px-3 py-1 text-xs font-semibold ${
                  health?.connected ? 'badge-green' : 'badge-red'
                }`}
              >
                {health?.connected ? 'CONNECTED' : 'DISCONNECTED'}
              </span>
            </div>

            <div className="grid-2 gap-4 mb-5">
              <div className="p-4 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg space-y-1.5 shadow-xs">
                <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                  Operating Mode
                </div>
                <div className="text-base font-bold text-[var(--accent-dark)] flex items-center gap-2">
                  <span>{health?.mode || 'UNKNOWN'}</span>
                  {health?.mode === 'REPLICA_SET' && (
                    <span className="text-xs px-2.5 py-0.5 rounded bg-[var(--accent-green-bg)] text-[var(--accent-green)] border border-[var(--accent-green-border)] font-semibold">
                      High Availability
                    </span>
                  )}
                  {health?.mode === 'SHARDED' && (
                    <span className="text-xs px-2.5 py-0.5 rounded bg-[var(--accent-blue-bg)] text-[var(--accent-blue)] border border-[var(--accent-blue-border)] font-semibold">
                      Horizontal Scale
                    </span>
                  )}
                  {health?.mode === 'STANDALONE' && (
                    <span className="text-xs px-2.5 py-0.5 rounded bg-[var(--accent-yellow-bg)] text-[var(--accent-yellow)] border border-[var(--accent-yellow-border)] font-semibold">
                      Baseline
                    </span>
                  )}
                </div>
              </div>

              <div className="p-4 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg space-y-1.5 shadow-xs">
                <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">
                  Primary Master / Router
                </div>
                <div className="text-sm font-mono text-[var(--accent-primary)] font-bold truncate">
                  {health?.primary_host || health?.uri?.split('/')[2] || 'N/A'}
                </div>
              </div>
            </div>

            {/* Connection URI info */}
            <div className="p-4 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg text-xs font-mono text-[var(--text-secondary)] mb-5 shadow-xs overflow-x-auto">
              <div className="text-[11px] text-[var(--text-muted)] uppercase tracking-wider font-semibold mb-1.5">
                Connection String
              </div>
              <div className="break-all leading-relaxed font-mono">
                {health?.uri || 'Connecting to backend...'}
              </div>
            </div>
          </div>

          {/* Cluster Nodes list if RS */}
          {health?.hosts && health.hosts.length > 0 && (
            <div className="pt-2">
              <div className="text-xs font-semibold text-[var(--text-secondary)] mb-2.5 font-serif flex items-center gap-2">
                <span>Replica Set Members ({health.hosts.length} Nodes):</span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {health.hosts.map((host, i) => (
                  <span
                    key={i}
                    className={`px-3 py-1.5 text-xs rounded-md border font-mono transition-all shadow-xs ${
                      host === health.primary_host
                        ? 'bg-[var(--accent-green-bg)] text-[var(--accent-green)] border-[var(--accent-green-border)] font-bold'
                        : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border)]'
                    }`}
                  >
                    {host} {host === health.primary_host ? '★ PRIMARY' : 'SECONDARY'}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Experiment Navigation Shortcuts */}
        <div className="card flex flex-col justify-between p-7">
          <div>
            <div className="card-header mb-3">
              <span className="card-title flex items-center gap-2 font-serif text-sm">
                <Layers className="w-4 h-4 text-[var(--accent-primary)]" />
                Distributed Systems Labs
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-5">
              Explore hands-on experiments directly reflecting your project's Python test suites:
            </p>

            <div className="space-y-3">
              <Link
                to="/replication"
                className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-[var(--bg-primary)] hover:bg-[var(--bg-hover)] border border-[var(--border)] text-xs text-[var(--text-primary)] font-medium transition-all shadow-xs hover:shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-[var(--accent-green)]" />
                  <span>Replication Verification</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
              </Link>

              <Link
                to="/consistency"
                className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-[var(--bg-primary)] hover:bg-[var(--bg-hover)] border border-[var(--border)] text-xs text-[var(--text-primary)] font-medium transition-all shadow-xs hover:shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <Activity className="w-4 h-4 text-[var(--accent-blue)]" />
                  <span>Write Concern & Read Prefs</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
              </Link>

              <Link
                to="/failover"
                className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-[var(--bg-primary)] hover:bg-[var(--bg-hover)] border border-[var(--border)] text-xs text-[var(--text-primary)] font-medium transition-all shadow-xs hover:shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <HardDrive className="w-4 h-4 text-[var(--accent-red)]" />
                  <span>Failover & Leader Election</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
              </Link>

              <Link
                to="/sharding"
                className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-[var(--bg-primary)] hover:bg-[var(--bg-hover)] border border-[var(--border)] text-xs text-[var(--text-primary)] font-medium transition-all shadow-xs hover:shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <HardDrive className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span>Sharding & Chunk Balancing</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
              </Link>

              <Link
                to="/benchmarks"
                className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-[var(--bg-primary)] hover:bg-[var(--bg-hover)] border border-[var(--border)] text-xs text-[var(--text-primary)] font-medium transition-all shadow-xs hover:shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <Zap className="w-4 h-4 text-[var(--accent-gold-dark)]" />
                  <span>Cross-Architecture Benchmarks</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
              </Link>
            </div>
          </div>

          <div className="mt-5 pt-3.5 border-t border-[var(--border)] flex justify-between items-center text-[11px] text-[var(--text-muted)]">
            <span>Library Service v1.0</span>
            <span className="text-[var(--accent-primary)] font-mono font-semibold">Academic UI</span>
          </div>
        </div>
      </div>

      {/* Recent Circulation Transactions Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title flex items-center gap-2">
            <Repeat className="w-4 h-4 text-[var(--accent-primary)]" />
            Recent Circulation Transactions
          </span>
          <Link to="/transactions" className="btn btn-sm">
            View All Transactions
          </Link>
        </div>

        {loadingTxns ? (
          <div className="py-8 text-center text-xs text-[var(--text-muted)]">
            <div className="loading-spinner mb-2" />
            <div>Loading recent transactions...</div>
          </div>
        ) : recentTxns.length === 0 ? (
          <div className="empty-state">
            <p>No circulation transactions recorded yet.</p>
            <Link to="/transactions" className="btn btn-sm btn-primary mt-2">
              Issue a Book
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Txn ID</th>
                  <th>Book ID</th>
                  <th>Member ID</th>
                  <th>Issue Date</th>
                  <th>Return Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTxns.map((tx) => (
                  <tr key={tx.transactionId}>
                    <td className="font-mono text-xs font-semibold text-[var(--accent-primary)]">
                      {tx.transactionId}
                    </td>
                    <td className="font-mono text-xs text-[var(--text-secondary)]">
                      {tx.bookId}
                    </td>
                    <td className="font-mono text-xs text-[var(--text-secondary)]">
                      {tx.memberId}
                    </td>
                    <td className="text-xs text-[var(--text-primary)]">
                      {new Date(tx.issueDate).toLocaleString()}
                    </td>
                    <td className="text-xs text-[var(--text-primary)]">
                      {tx.returnDate ? new Date(tx.returnDate).toLocaleString() : '—'}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          tx.status === 'ISSUED' ? 'badge-yellow' : 'badge-green'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
