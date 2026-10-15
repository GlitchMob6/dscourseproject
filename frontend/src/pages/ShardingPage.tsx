import { useState, useEffect } from 'react';
import {
  Network,
  Database,
  Layers,
  RefreshCw,
  HardDrive,
  BarChart2,
  PieChart as PieIcon,
  AlertCircle,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import type { ShardingStatus } from '../types';
import { apiGet } from '../api';
import { useToast } from '../context/ToastContext';

const SHARD_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

export const ShardingPage: React.FC = () => {
  const [status, setStatus] = useState<ShardingStatus | null>(null);
  const [loading, setLoading] = useState(false);

  const { showToast } = useToast();

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const data = await apiGet<ShardingStatus>('/sharding/status');
      setStatus(data);
    } catch (e: any) {
      showToast('Error loading sharding status: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const distributionData =
    status?.distribution?.map((d) => ({
      name: d.shard,
      value: d.count,
      sizeKB: d.sizeKB,
      percentage: d.percentage,
    })) || [];

  return (
    <div className="space-y-8">
      <div className="page-header flex items-center justify-between">
        <div>
          <h2>Sharding & Partitioning Status</h2>
          <p>
            Inspect the mongos query router, active data shards, compound shard key partitioning, and chunk distribution.
          </p>
        </div>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="btn btn-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Sharding</span>
        </button>
      </div>

      {loading && !status ? (
        <div className="card py-16 text-center text-xs text-[var(--text-muted)]">
          <div className="loading-spinner mb-2" />
          <div>Querying mongos router metadata on port 27050...</div>
        </div>
      ) : !status?.connected ? (
        <div className="card text-center py-10">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-white mb-1">
            mongos Router Not Connected
          </h3>
          <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
            Unable to connect to the mongos query router at <code>mongodb://127.0.0.1:27050</code>.
            Please ensure your sharded cluster services (mongos, config replica set, and shard replica sets) are active.
          </p>
        </div>
      ) : (
        <>
          {/* Top Level Sharded Configuration Cards */}
          <div className="grid-3">
            <div className="card">
              <div className="card-header">
                <span className="card-title">Cluster Router</span>
                <Network className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="stat-value text-cyan-400">mongos</div>
              <div className="stat-label">Port 27050 (isdbgrid: Active)</div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Registered Shards</span>
                <HardDrive className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="stat-value text-emerald-400">
                {status.shards?.length || 0}
              </div>
              <div className="stat-label">Active horizontal storage nodes</div>
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">Total Sharded Books</span>
                <Database className="w-4 h-4 text-purple-400" />
              </div>
              <div className="stat-value text-purple-400">
                {status.totalBooks ?? '—'}
              </div>
              <div className="stat-label">Indexed in library_db.books</div>
            </div>
          </div>

          {/* Shard Topology List */}
          <div className="card">
            <div className="card-header">
              <span className="card-title flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-cyan-400" />
                Cluster Shard Members
              </span>
            </div>

            {status.shards && status.shards.length > 0 ? (
              <div className="grid-2">
                {status.shards.map((sh, idx) => (
                  <div
                    key={sh.id}
                    className="p-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{
                            backgroundColor:
                              SHARD_COLORS[idx % SHARD_COLORS.length],
                          }}
                        />
                        {sh.id}
                      </div>
                      <div className="text-xs font-mono text-slate-400 mt-1">
                        Host: {sh.host}
                      </div>
                    </div>
                    <span className="badge badge-green">STATE: {sh.state}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-muted)]">No shards registered.</p>
            )}
          </div>

          {/* Document Distribution Charts */}
          <div className="grid-2">
            {/* Pie Chart */}
            <div className="card">
              <div className="card-header">
                <span className="card-title flex items-center gap-2">
                  <PieIcon className="w-4 h-4 text-emerald-400" />
                  Document Distribution Ratio
                </span>
              </div>

              {distributionData.length > 0 ? (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={distributionData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }: { name?: string; percent?: number }) =>
                          `${name ?? ''}: ${((percent ?? 0) * 100).toFixed(1)}%`
                        }
                        labelLine={true}
                      >
                        {distributionData.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={SHARD_COLORS[index % SHARD_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1c1f2e',
                          borderColor: '#2a2e3f',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="empty-state">
                  <p>No document distribution data available.</p>
                </div>
              )}
            </div>

            {/* Bar Chart by count and size */}
            <div className="card">
              <div className="card-header">
                <span className="card-title flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-cyan-400" />
                  Document Count per Shard
                </span>
              </div>

              {distributionData.length > 0 ? (
                <div className="h-64 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={distributionData}
                      margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#2a2e3f" />
                      <XAxis dataKey="name" stroke="#8b8fa3" fontSize={11} />
                      <YAxis stroke="#8b8fa3" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1c1f2e',
                          borderColor: '#2a2e3f',
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Documents" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="empty-state">
                  <p>No documents found.</p>
                </div>
              )}
            </div>
          </div>

          {/* Collection Sharding Metadata */}
          <div className="card">
            <div className="card-header">
              <span className="card-title flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                Collection Sharding Configuration
              </span>
            </div>

            <div className="grid-2 text-xs">
              <div className="p-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded space-y-1">
                <div className="text-[var(--text-muted)] uppercase font-semibold">
                  Target Namespace
                </div>
                <div className="text-white font-mono font-bold">
                  library_db.books
                </div>
              </div>

              <div className="p-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded space-y-1">
                <div className="text-[var(--text-muted)] uppercase font-semibold">
                  Compound Shard Key
                </div>
                <div className="text-cyan-400 font-mono font-bold">
                  {status.collection?.shardKey
                    ? JSON.stringify(status.collection.shardKey)
                    : '{ category: 1, bookId: 1 }'}
                </div>
              </div>
            </div>
          </div>

          {/* Chunks Boundaries Table */}
          {status.chunks && status.chunks.length > 0 && (
            <div className="card">
              <div className="card-header">
                <span className="card-title">
                  Config Chunks Mapping ({status.chunks.length} Sample Chunks)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Target Shard</th>
                      <th>Min Key Range</th>
                      <th>Max Key Range</th>
                    </tr>
                  </thead>
                  <tbody>
                    {status.chunks.map((chk, idx) => (
                      <tr key={idx}>
                        <td className="font-semibold text-white font-mono">
                          {chk.shard}
                        </td>
                        <td className="font-mono text-xs text-cyan-400 truncate max-w-xs">
                          {chk.min}
                        </td>
                        <td className="font-mono text-xs text-emerald-400 truncate max-w-xs">
                          {chk.max}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Distributed Concept Guide */}
      <div className="info-panel">
        <h4>Compound Shard Key Selection Rationale</h4>
        <p>
          Selecting a shard key requires balancing <strong>write distribution</strong> against <strong>query targeting</strong>.
          A low-cardinality prefix like <code>category</code> groups related books on the same shard for fast range queries, while
          the high-cardinality suffix <code>bookId</code> prevents jumbo chunks and guarantees even document distribution across all shards.
        </p>
      </div>
    </div>
  );
};
