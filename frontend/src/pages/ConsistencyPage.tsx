import React, { useState } from 'react';
import {
  Scale,
  Play,
  Activity,
  Clock,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import type { ConsistencyResult } from '../types';
import { apiPost, pollJob } from '../api';
import { useToast } from '../context/ToastContext';

export const ConsistencyPage: React.FC = () => {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ConsistencyResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { showToast } = useToast();

  const handleRunExperiment = async () => {
    setRunning(true);
    setResult(null);
    setErrorMsg(null);
    try {
      showToast('Running Consistency & Quorum experiment...', 'info');
      const startRes = await apiPost('/consistency/experiment');
      const job = await pollJob(startRes.job_id, 1500, 40);
      setResult(job.result);
      showToast('Consistency experiment completed!', 'success');
    } catch (err: any) {
      setErrorMsg(err.message || 'Experiment failed');
      showToast(err.message || 'Experiment failed', 'error');
    } finally {
      setRunning(false);
    }
  };

  // Prepare chart data from 20 iterations
  const chartData =
    result?.writeConcern?.w1?.latencies?.map((w1Lat, idx) => ({
      iteration: `#${idx + 1}`,
      'w: 1 (Primary Only)': w1Lat,
      'w: majority (Quorum)': result.writeConcern.wMajority.latencies[idx] || 0,
    })) || [];

  return (
    <div className="space-y-8">
      <div className="page-header flex items-center justify-between">
        <div>
          <h2>Consistency & Quorum Lab</h2>
          <p>
            Evaluate MongoDB PACELC trade-offs by comparing write concern durability overhead and read preference routing latency.
          </p>
        </div>
        <button
          onClick={handleRunExperiment}
          disabled={running}
          className="btn btn-primary"
        >
          <Play className="w-4 h-4" />
          <span>{running ? 'Running Experiment...' : 'Run Consistency Lab'}</span>
        </button>
      </div>

      {running ? (
        <div className="card py-16 text-center text-xs text-[var(--text-muted)]">
          <div className="loading-spinner mb-3" />
          <div className="text-[var(--text-primary)] text-sm font-semibold font-serif mb-1">
            Running 40 write operations & probing read preferences...
          </div>
          <p className="text-[var(--text-secondary)]">Measuring round-trip latencies for w:1 vs w:majority on rs0.</p>
        </div>
      ) : errorMsg ? (
        <div className="p-4 bg-[var(--status-error)]/10 border border-[var(--status-error)]/30 rounded text-xs text-[var(--status-error)]">
          <strong>Experiment Error:</strong> {errorMsg}
        </div>
      ) : !result ? (
        <div className="empty-state card">
          <Scale className="w-12 h-12 mx-auto text-[var(--accent-primary)] mb-2" />
          <h3 className="text-base font-semibold text-[var(--text-primary)] font-serif mb-1">
            Ready to Test Consistency Trade-Offs
          </h3>
          <p className="text-xs text-[var(--text-secondary)] max-w-lg mx-auto mb-4">
            Click &quot;Run Consistency Lab&quot; to execute 20 sequential writes with <code>w: 1</code> (fast, unacknowledged secondary replication)
            followed by 20 writes with <code>w: &quot;majority&quot;</code> (quorum acknowledgment across majority of nodes), then test read preference isolation.
          </p>
          <button onClick={handleRunExperiment} className="btn btn-primary">
            Run Experiment Now
          </button>
        </div>
      ) : (
        <>
          {/* Write Concern Metrics Comparison Cards */}
          <div className="grid-2">
            {/* w:1 Card */}
            <div className="card border-l-4 border-l-[var(--accent-gold)]">
              <div className="flex items-center justify-between mb-2">
                <span className="card-title text-[var(--accent-gold)] font-serif">
                  {result.writeConcern.w1.label}
                </span>
                <span className="badge badge-yellow">
                  {result.writeConcern.w1.durability}
                </span>
              </div>
              <div className="stat-value text-[var(--accent-gold)]">
                {result.writeConcern.w1.avg} <span className="text-sm font-normal text-[var(--text-muted)]">ms avg</span>
              </div>
              <div className="mt-3 grid-2 text-xs font-mono p-2.5 bg-[var(--bg-primary)] rounded border border-[var(--border)]">
                <div>Min: <span className="text-[var(--text-primary)] font-bold">{result.writeConcern.w1.min} ms</span></div>
                <div>Max: <span className="text-[var(--text-primary)] font-bold">{result.writeConcern.w1.max} ms</span></div>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] mt-2">
                Acknowledged as soon as the standalone Primary commits to memory. Secondary node lag does not block the client.
              </p>
            </div>

            {/* w:majority Card */}
            <div className="card border-l-4 border-l-[var(--status-success)]">
              <div className="flex items-center justify-between mb-2">
                <span className="card-title text-[var(--status-success)] font-serif">
                  {result.writeConcern.wMajority.label}
                </span>
                <span className="badge badge-green">
                  {result.writeConcern.wMajority.durability}
                </span>
              </div>
              <div className="stat-value text-[var(--status-success)]">
                {result.writeConcern.wMajority.avg} <span className="text-sm font-normal text-[var(--text-muted)]">ms avg</span>
              </div>
              <div className="mt-3 grid-2 text-xs font-mono p-2.5 bg-[var(--bg-primary)] rounded border border-[var(--border)]">
                <div>Min: <span className="text-[var(--text-primary)] font-bold">{result.writeConcern.wMajority.min} ms</span></div>
                <div>Max: <span className="text-[var(--text-primary)] font-bold">{result.writeConcern.wMajority.max} ms</span></div>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] mt-2">
                Requires acknowledgment from a majority of voting replica set members (at least 2 of 3 nodes) before returning success.
              </p>
            </div>
          </div>

          {/* Interactive Latency Distribution Chart */}
          <div className="card">
            <div className="card-header">
              <span className="card-title flex items-center gap-2 font-serif">
                <Activity className="w-4 h-4 text-[var(--accent-primary)]" />
                Write Latency Distribution per Iteration (ms)
              </span>
            </div>

            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#D8BFA4" />
                  <XAxis dataKey="iteration" stroke="#705641" fontSize={11} />
                  <YAxis stroke="#705641" fontSize={11} unit="ms" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#FAF4E9',
                      borderColor: '#A9784D',
                      borderRadius: 8,
                      fontSize: 12,
                      color: '#2C1B12',
                      boxShadow: '0 4px 12px rgba(44, 27, 18, 0.15)',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10, color: '#2C1B12' }} />
                  <Bar dataKey="w: 1 (Primary Only)" fill="#C9A447" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="w: majority (Quorum)" fill="#6B3218" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Read Preference Experiment Table */}
          <div className="card">
            <div className="card-header">
              <span className="card-title flex items-center gap-2 font-serif">
                <Clock className="w-4 h-4 text-[var(--accent-copper)]" />
                Read Preference Routing & Latency Results
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Read Mode</th>
                    <th>Consistency Level</th>
                    <th>Behavior & Target</th>
                    <th>Doc Retrieved</th>
                    <th>Read Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {result.readPreference.map((rp, i) => (
                    <tr key={i}>
                      <td className="font-mono text-xs font-bold text-[var(--accent-primary)]">
                        {rp.mode}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            rp.mode === 'primary' ? 'badge-green' : 'badge-purple'
                          }`}
                        >
                          {rp.description}
                        </span>
                      </td>
                      <td className="text-xs text-[var(--text-secondary)]">
                        {rp.mode === 'primary' && 'Reads exclusively from Primary; guarantees linearizability.'}
                        {rp.mode === 'secondary' && 'Offloads read load to secondaries; allows eventual consistency.'}
                        {rp.mode === 'secondaryPreferred' && 'Uses secondaries if healthy; falls back to Primary.'}
                        {rp.mode === 'nearest' && 'Routes to the member with lowest network round-trip latency.'}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            rp.found ? 'badge-green' : 'badge-red'
                          }`}
                        >
                          {rp.found ? 'FOUND (Verified)' : 'MISSING'}
                        </span>
                      </td>
                      <td className="font-mono text-xs font-semibold text-[var(--text-primary)]">
                        {rp.latencyMs} ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Distributed Concept Guide */}
      <div className="info-panel">
        <h4 className="font-serif text-[var(--accent-primary)]">CAP / PACELC Theorem Implications</h4>
        <p>
          According to PACELC: In a distributed system, <strong>if Partition (P)</strong>: trade Availability (A) vs Consistency (C);{' '}
          <strong>Else (E)</strong>: trade Latency (L) vs Consistency (C). Using <code>w: majority</code> provides strict consistency at the cost
          of network latency overhead (E-C). Using <code>w: 1</code> maximizes write throughput and minimizes latency at the risk of losing
          unreplicated writes if the primary abruptly crashes before oplog synchronization (E-L).
        </p>
      </div>
    </div>
  );
};
