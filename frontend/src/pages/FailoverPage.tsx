import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Server,
  RefreshCw,
  Power,
  RotateCcw,
} from 'lucide-react';
import type { ReplicationStatus } from '../types';
import { apiGet, apiPost, pollJob } from '../api';
import { useToast } from '../context/ToastContext';

export const FailoverPage: React.FC = () => {
  const [status, setStatus] = useState<ReplicationStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // Experiment state
  const [runningType, setRunningType] = useState<string | null>(null);
  const [experimentResult, setExperimentResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { showToast } = useToast();

  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const data = await apiGet('/failover/status');
      setStatus(data);
    } catch (e: any) {
      showToast('Error fetching cluster status: ' + e.message, 'error');
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleFaultToleranceDemo = async () => {
    setRunningType('fault_tolerance');
    setExperimentResult(null);
    setErrorMsg(null);
    try {
      showToast('Simulating secondary node failure (port 27020)...', 'info');
      const startRes = await apiPost('/failover/fault-tolerance', { targetPort: 27020 });
      const job = await pollJob(startRes.job_id, 2000, 45);
      setExperimentResult(job.result);
      showToast('Fault-tolerance demonstration completed!', 'success');
      fetchStatus();
    } catch (err: any) {
      setErrorMsg(err.message || 'Fault-tolerance demo failed');
      showToast(err.message || 'Fault-tolerance demo failed', 'error');
    } finally {
      setRunningType(null);
    }
  };

  const handlePrimaryFailoverDemo = async () => {
    setRunningType('failover');
    setExperimentResult(null);
    setErrorMsg(null);
    try {
      showToast('Simulating primary node crash and leader election...', 'info');
      const startRes = await apiPost('/failover/failover');
      const job = await pollJob(startRes.job_id, 2000, 45);
      setExperimentResult(job.result);
      showToast('Leader election & failover test completed!', 'success');
      fetchStatus();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failover demo failed');
      showToast(err.message || 'Failover demo failed', 'error');
    } finally {
      setRunningType(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="page-header flex items-center justify-between">
        <div>
          <h2>Failover & Leader Election Demo</h2>
          <p>
            Experience automated high availability, Byzantine fault recovery, and Raft/Paxos-style quorum election in MongoDB.
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
            <span>Refresh Health</span>
          </button>
        </div>
      </div>

      {/* Cluster Node Status Cards */}
      <div>
        <div className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
          <Server className="w-4 h-4 text-cyan-400" />
          Active Replica Set Health
        </div>

        {loadingStatus && !status ? (
          <div className="py-12 text-center text-xs text-[var(--text-muted)] card">
            <div className="loading-spinner mb-2" />
            <div>Checking cluster node health...</div>
          </div>
        ) : !status?.connected ? (
          <div className="card text-center py-8">
            <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-white mb-1">
              Replica Set rs0 Unreachable
            </h4>
            <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
              Please ensure your 3 MongoDB nodes (ports 27018, 27019, 27020) are started.
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

                  <div className="p-2.5 bg-[var(--bg-primary)] rounded border border-[var(--border)] text-left text-xs space-y-1 font-mono">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">State:</span>
                      <span
                        className={
                          isHealthy ? 'text-emerald-400' : 'text-rose-400'
                        }
                      >
                        {node.health}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-muted)]">Uptime:</span>
                      <span className="text-slate-300">
                        {Math.floor(node.uptime / 60)} min
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
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Two Action Demo Panels */}
      <div className="grid-2">
        {/* Fault Tolerance Demo (Crash Secondary) */}
        <div className="card">
          <div className="card-header">
            <span className="card-title flex items-center gap-2 text-amber-400">
              <Power className="w-4 h-4" />
              Demo 1: Secondary Node Crash & Quorum Survival
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mb-4">
            Shuts down secondary Node 3 (port 27020) to demonstrate that the cluster retains quorum (2/3 nodes = majority)
            and continues processing both reads and writes without service interruption. Automatically restarts the node after testing.
          </p>
          <button
            onClick={handleFaultToleranceDemo}
            disabled={runningType !== null}
            className="btn btn-primary w-full justify-center"
          >
            {runningType === 'fault_tolerance'
              ? 'Running Fault Tolerance Demo...'
              : 'Simulate Secondary Crash (Port 27020)'}
          </button>
        </div>

        {/* Primary Failover Demo (Leader Election) */}
        <div className="card">
          <div className="card-header">
            <span className="card-title flex items-center gap-2 text-rose-400">
              <RotateCcw className="w-4 h-4" />
              Demo 2: Primary Node Crash & Automatic Election
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mb-4">
            Forcefully shuts down the current Primary master. The remaining 2 secondary nodes detect heartbeat timeout,
            initiate a Raft-like election, elect a new Primary, and restore write operations within seconds. Restarts old primary as secondary.
          </p>
          <button
            onClick={handlePrimaryFailoverDemo}
            disabled={runningType !== null}
            className="btn btn-danger w-full justify-center"
          >
            {runningType === 'failover'
              ? 'Running Failover Election Demo...'
              : 'Trigger Primary Crash & Re-Election'}
          </button>
        </div>
      </div>

      {/* Experiment Progress / Timeline Output */}
      {runningType && (
        <div className="card py-12 text-center text-xs text-[var(--text-muted)]">
          <div className="loading-spinner mb-3" />
          <div className="text-white text-sm font-semibold mb-1">
            Running {runningType === 'failover' ? 'Leader Election' : 'Fault Tolerance'} Experiment...
          </div>
          <p>Stopping mongod node, measuring failover downtime, and restarting process.</p>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-400">
          <strong>Error during failover experiment:</strong> {errorMsg}
        </div>
      )}

      {experimentResult && (
        <div className="card">
          <div className="card-header">
            <span className="card-title flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Experiment Execution Timeline & Results
            </span>
            {experimentResult.failoverDurationSeconds && (
              <span className="badge badge-green font-mono text-xs">
                Election Time: {experimentResult.failoverDurationSeconds}s
              </span>
            )}
          </div>

          <div className="space-y-3">
            {experimentResult.steps?.map((st: any, idx: number) => (
              <div key={idx} className="experiment-step">
                <div
                  className={`step-indicator ${
                    st.status === 'success' ? 'success' : 'failed'
                  }`}
                >
                  {st.status === 'success' ? '✓' : '✕'}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-white">
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
                  {st.description && (
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      {st.description}
                    </p>
                  )}
                  {st.details && (
                    <div className="mt-2 p-2 bg-[var(--bg-primary)] rounded border border-[var(--border)] font-mono text-[11px] text-cyan-400">
                      {typeof st.details === 'object'
                        ? JSON.stringify(st.details, null, 2)
                        : st.details}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Distributed Consensus Explainer */}
      <div className="info-panel">
        <h4>Heartbeat Protocol & Split-Brain Prevention</h4>
        <p>
          Replica set nodes exchange periodic heartbeats every 2 seconds. If a secondary does not receive a heartbeat from the primary
          within the election timeout period (default 10s), it transitions to candidate state and requests votes.
          A candidate requires votes from a strict majority <code>(N/2 + 1 = 2)</code> of voting members to become the new Primary.
          This majority requirement mathematically guarantees that split-brain scenarios (two active primaries) can never occur.
        </p>
      </div>
    </div>
  );
};
