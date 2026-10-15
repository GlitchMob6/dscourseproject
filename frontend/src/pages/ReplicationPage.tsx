import React, { useState, useEffect } from 'react';
import {
  Play,
  XCircle,
  Server,
  RefreshCw,
  Radio,
} from 'lucide-react';
import type { ReplicationStatus, ReplicationExperimentResult } from '../types';
import { apiGet, apiPost, pollJob } from '../api';
import { useToast } from '../context/ToastContext';

export const ReplicationPage: React.FC = () => {
  const [status, setStatus] = useState<ReplicationStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Experiment run state
  const [running, setRunning] = useState(false);
  const [experimentResult, setExperimentResult] =
    useState<ReplicationExperimentResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { showToast } = useToast();

  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const data = await apiGet<ReplicationStatus>('/replication/status');
      setStatus(data);
    } catch (e: any) {
      showToast('Error fetching replication status: ' + e.message, 'error');
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleRunExperiment = async () => {
    setRunning(true);
    setExperimentResult(null);
    setErrorMsg(null);
    try {
      showToast('Initiating replication experiment on rs0...', 'info');
      const startRes = await apiPost('/replication/experiment');
      const job = await pollJob(startRes.job_id, 1500, 30);
      setExperimentResult(job.result);
      showToast('Replication experiment finished successfully!', 'success');
      fetchStatus();
    } catch (err: any) {
      setErrorMsg(err.message || 'Experiment failed');
      showToast(err.message || 'Experiment failed', 'error');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="page-header flex items-center justify-between">
        <div>
          <h2>Replication & Oplog Verification</h2>
          <p>
            Inspect the 3-node MongoDB Replica Set (rs0), monitor master/worker oplog sync, and run live replication tests.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchStatus}
            disabled={loadingStatus}
            className="btn btn-sm"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin' : ''}`}
            />
            <span>Refresh Nodes</span>
          </button>
          <button
            onClick={handleRunExperiment}
            disabled={running}
            className="btn btn-primary"
          >
            <Play className="w-4 h-4" />
            <span>{running ? 'Running Experiment...' : 'Run Replication Test'}</span>
          </button>
        </div>
      </div>

      {/* 3-Node Topology Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            Active Replica Set Members (rs0)
          </div>
          {status?.primary && (
            <span className="text-xs font-mono text-emerald-400">
              Primary: {status.primary}
            </span>
          )}
        </div>

        {loadingStatus && !status ? (
          <div className="py-12 text-center text-xs text-[var(--text-muted)] card">
            <div className="loading-spinner mb-2" />
            <div>Inspecting replica set topology...</div>
          </div>
        ) : !status?.connected ? (
          <div className="card text-center py-8">
            <XCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-white mb-1">
              Replica Set Not Reachable
            </h4>
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
              Could not connect to MongoDB nodes at 127.0.0.1:27018-27020. Please verify that the replica set
              daemon is running in the background.
            </p>
          </div>
        ) : (
          <div className="grid-3">
            {status.members.map((node) => {
              const isPrimary = node.state === 'PRIMARY';
              const isHealthy = node.health === 'HEALTHY';
              return (
                <div
                  key={node.id}
                  className={`node-card ${
                    isPrimary ? 'primary' : isHealthy ? 'secondary' : 'down'
                  }`}
                >
                  <div
                    className={`node-role ${
                      isPrimary
                        ? 'text-emerald-400'
                        : isHealthy
                        ? 'text-blue-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {node.state}
                  </div>
                  <div className="text-base font-bold text-white font-mono mb-1">
                    {node.name}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mb-3">
                    Node ID: {node.id}
                  </div>

                  <div className="p-2.5 bg-[var(--bg-primary)] rounded border border-[var(--border)] text-left text-xs space-y-1.5 font-mono">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Health:</span>
                      <span
                        className={
                          isHealthy
                            ? 'text-emerald-400 font-semibold'
                            : 'text-rose-400 font-semibold'
                        }
                      >
                        {node.health}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Uptime:</span>
                      <span className="text-slate-300">
                        {Math.floor(node.uptime / 60)}m {node.uptime % 60}s
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Oplog TS:</span>
                      <span
                        className="text-cyan-400 truncate max-w-[120px]"
                        title={node.optime}
                      >
                        {node.optime}
                      </span>
                    </div>
                    {node.syncSourceHost && (
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Syncing:</span>
                        <span className="text-slate-300">
                          {node.syncSourceHost}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Live Experiment Results Panel */}
      <div className="card">
        <div className="card-header">
          <span className="card-title flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            Live Replication Experiment Timeline
          </span>
          {experimentResult?.completedAt && (
            <span className="text-xs text-[var(--text-muted)] font-mono">
              Completed: {new Date(experimentResult.completedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {running ? (
          <div className="py-12 text-center text-xs text-[var(--text-muted)]">
            <div className="loading-spinner mb-3" />
            <div className="text-white font-semibold mb-1">
              Executing Experiment Pipeline...
            </div>
            <p>
              Inserting document on primary node & probing replica direct connections.
            </p>
          </div>
        ) : errorMsg ? (
          <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-400">
            <strong>Experiment Failed:</strong> {errorMsg}
          </div>
        ) : !experimentResult ? (
          <div className="empty-state">
            <Play className="w-10 h-10 mx-auto" />
            <p className="font-semibold text-white">No Experiment Run Yet</p>
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto mt-1 mb-4">
              Click &quot;Run Replication Test&quot; above to insert a unique document on the primary node and verify
              synchronous replication across all 3 standalone member instances.
            </p>
            <button onClick={handleRunExperiment} className="btn btn-primary btn-sm">
              Launch Experiment
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {experimentResult.steps.map((st) => (
              <div key={st.step} className="experiment-step">
                <div
                  className={`step-indicator ${
                    st.status === 'success' ? 'success' : 'failed'
                  }`}
                >
                  {st.status === 'success' ? '✓' : '✕'}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white">
                      Step {st.step}: {st.title}
                    </h4>
                    <span
                      className={`badge ${
                        st.status === 'success' ? 'badge-green' : 'badge-red'
                      }`}
                    >
                      {st.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Step 2 Insert details */}
                  {st.step === 2 && (
                    <div className="mt-2 text-xs font-mono text-[var(--text-secondary)] space-y-1">
                      <div>Generated Doc ID: <span className="text-cyan-400">{st.testId}</span></div>
                      <div>Primary Write Latency: <span className="text-emerald-400 font-bold">{st.writeLatencyMs} ms</span></div>
                    </div>
                  )}

                  {/* Step 3 Direct Node Verification table */}
                  {st.step === 3 && st.nodes && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Node</th>
                            <th>Port</th>
                            <th>Direct Role</th>
                            <th>Replication Status</th>
                            <th>Read Latency</th>
                          </tr>
                        </thead>
                        <tbody>
                          {st.nodes.map((n: any, idx: number) => (
                            <tr key={idx}>
                              <td className="font-semibold text-white">{n.node}</td>
                              <td className="font-mono text-xs">{n.port}</td>
                              <td>
                                <span
                                  className={`badge ${
                                    n.role === 'PRIMARY'
                                      ? 'badge-green font-bold'
                                      : 'badge-blue'
                                  }`}
                                >
                                  {n.role}
                                </span>
                              </td>
                              <td>
                                <span
                                  className={`badge ${
                                    n.syncStatus === 'SYNCHRONIZED'
                                      ? 'badge-green'
                                      : 'badge-red'
                                  }`}
                                >
                                  {n.syncStatus}
                                </span>
                              </td>
                              <td className="font-mono text-xs text-slate-300">
                                {n.readLatencyMs ? `${n.readLatencyMs} ms` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Step 4 Update propagation */}
                  {st.step === 4 && st.updateResults && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Node</th>
                            <th>Port</th>
                            <th>Updated Value (availableCopies)</th>
                            <th>Propagation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {st.updateResults.map((u: any, idx: number) => (
                            <tr key={idx}>
                              <td className="font-semibold text-white">{u.node}</td>
                              <td className="font-mono text-xs">{u.port}</td>
                              <td className="font-mono text-xs text-cyan-400">
                                {u.availableCopies !== null ? u.availableCopies : '—'}
                              </td>
                              <td>
                                <span
                                  className={`badge ${
                                    u.replicated ? 'badge-green' : 'badge-red'
                                  }`}
                                >
                                  {u.replicated ? 'SYNCHRONIZED' : 'PENDING / FAILED'}
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
            ))}
          </div>
        )}
      </div>

      {/* Distributed Concept Card */}
      <div className="info-panel">
        <h4>Understanding MongoDB Asynchronous Oplog Replication</h4>
        <p>
          MongoDB replication uses an internal capped collection named <code>local.oplog.rs</code>. When a write executes on the
          Primary node, it is committed locally and written to the oplog. Secondary nodes continuously tail the Primary&apos;s oplog and
          apply changes asynchronously in parallel batches. By establishing direct connections (<code>directConnection=true</code>)
          to each secondary, this experiment proves data convergence and verifies that eventual consistency is maintained with sub-millisecond lag.
        </p>
      </div>
    </div>
  );
};
