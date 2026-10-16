import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  BookOpen,
  Library,
  Users,
  Repeat,
  Copy,
  Scale,
  ShieldAlert,
  Network,
  SearchCode,
  Gauge,
  RefreshCw,
  Server,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { apiGet, apiPost } from '../api';
import type { HealthStatus, ConnectivityStatus } from '../types';
import { useToast } from '../context/ToastContext';

export const Layout: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [switching, setSwitching] = useState(false);
  const [probeOpen, setProbeOpen] = useState(false);
  const [probeData, setProbeData] = useState<ConnectivityStatus | null>(null);
  const [probing, setProbing] = useState(false);
  const { showToast } = useToast();

  const fetchHealth = async () => {
    try {
      const data = await apiGet<HealthStatus>('/health');
      setHealth(data);
    } catch {
      setHealth(null);
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleSwitchMode = async (newMode: string) => {
    setSwitching(true);
    try {
      const res = await apiPost(`/health/switch?mode=${newMode}`);
      if (res.success) {
        showToast(`Switched active mode to ${newMode}`, 'success');
        await fetchHealth();
      } else {
        showToast(res.message || 'Failed to switch mode', 'error');
      }
    } catch (e: any) {
      showToast(e.message || 'Switch error', 'error');
    } finally {
      setSwitching(false);
    }
  };

  const probeTopologies = async () => {
    setProbing(true);
    setProbeOpen(true);
    try {
      const data = await apiGet<ConnectivityStatus>('/health/connectivity');
      setProbeData(data);
    } catch (e: any) {
      showToast('Error probing topologies: ' + e.message, 'error');
    } finally {
      setProbing(false);
    }
  };

  const getModeColor = (mode?: string) => {
    switch (mode) {
      case 'REPLICA_SET':
        return 'text-[var(--accent-green)] bg-[var(--accent-green-bg)] border-[var(--accent-green-border)]';
      case 'SHARDED':
        return 'text-[var(--accent-blue)] bg-[var(--accent-blue-bg)] border-[var(--accent-blue-border)]';
      case 'STANDALONE':
        return 'text-[var(--accent-yellow)] bg-[var(--accent-yellow-bg)] border-[var(--accent-yellow-border)]';
      default:
        return 'text-[var(--text-secondary)] bg-[var(--bg-card)] border-[var(--border)]';
    }
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="flex items-center gap-2.5">
            <Library className="w-5 h-5 text-[var(--accent-primary)]" />
            <div>
              <h1>DISTRIBUTED LIBRARY</h1>
              <p>MongoDB Cluster Management</p>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">General</div>
          <NavLink
            to="/"
            end
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Overview</span>
          </NavLink>

          <div className="nav-section-label">Library Management</div>
          <NavLink
            to="/books"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Books Catalog</span>
          </NavLink>
          <NavLink
            to="/members"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Users className="w-4 h-4" />
            <span>Members</span>
          </NavLink>
          <NavLink
            to="/transactions"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Repeat className="w-4 h-4" />
            <span>Issue & Returns</span>
          </NavLink>

          <div className="nav-section-label">Distributed Experiments</div>
          <NavLink
            to="/replication"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Copy className="w-4 h-4" />
            <span>Replication Lab</span>
          </NavLink>
          <NavLink
            to="/consistency"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Scale className="w-4 h-4" />
            <span>Consistency & Quorum</span>
          </NavLink>
          <NavLink
            to="/failover"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Failover & Election</span>
          </NavLink>
          <NavLink
            to="/sharding"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Network className="w-4 h-4" />
            <span>Sharding Distribution</span>
          </NavLink>
          <NavLink
            to="/queries"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <SearchCode className="w-4 h-4" />
            <span>Query Analyzer</span>
          </NavLink>
          <NavLink
            to="/benchmarks"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <Gauge className="w-4 h-4" />
            <span>Benchmarks & Data</span>
          </NavLink>
        </nav>

        {/* Sidebar Mini Status Footer */}
        <div className="p-4 border-t border-[var(--border)] text-xs text-[var(--text-muted)]" style={{background: 'linear-gradient(180deg, rgba(107,50,24,0.04) 0%, transparent 100%)'}}>
          <div className="flex items-center justify-between mb-2">
            <span className="uppercase tracking-wider text-[10px] font-semibold text-[var(--accent-primary)]">Active Target</span>
            <span className="font-mono text-[var(--text-secondary)] text-[11px] font-semibold">
              {health?.mode || 'DETECTING'}
            </span>
          </div>
          <div className="truncate text-[10px] font-mono text-[var(--text-muted)] bg-[var(--bg-primary)] border border-[var(--border-subtle)] rounded px-2 py-1.5">
            {health?.uri ? health.uri.split('?')[0] : 'Connecting...'}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-left">
            <div className="status-badge">
              <span
                className={`status-dot ${
                  health?.connected ? 'green' : 'red'
                }`}
              />
              <span className="font-semibold text-xs">{health?.connected ? 'MongoDB Online' : 'Database Offline'}</span>
            </div>

            {/* Architecture Mode Badge & Switcher */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-[var(--text-secondary)] font-medium">Mode:</span>
              <select
                className={`px-2.5 py-1 rounded text-xs font-semibold border cursor-pointer bg-[var(--bg-card)] ${getModeColor(
                  health?.mode
                )}`}
                value={health?.mode || 'REPLICA_SET'}
                disabled={switching}
                onChange={(e) => handleSwitchMode(e.target.value)}
              >
                <option value="REPLICA_SET">Replica Set (rs0 : 27018-20)</option>
                <option value="SHARDED">Sharded Cluster (mongos : 27050)</option>
                <option value="STANDALONE">Standalone (27017)</option>
              </select>
            </div>
          </div>

          <div className="topbar-right">
            <button
              onClick={probeTopologies}
              className="btn btn-sm"
              title="Inspect All 3 Database Topologies"
            >
              <Server className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>Probe Topologies</span>
            </button>

            <button
              onClick={() => {
                fetchHealth();
                showToast('Refreshed cluster status', 'info');
              }}
              className="btn btn-sm"
              title="Refresh Health"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
            </button>
          </div>
        </header>

        {/* Page View Body */}
        <main className="page-content">
          <Outlet context={{ health, refreshHealth: fetchHealth }} />
        </main>
      </div>

      {/* Topology Probe Modal */}
      {probeOpen && (
        <div className="modal-overlay" onClick={() => setProbeOpen(false)}>
          <div
            className="modal max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="modal-title mb-0 flex items-center gap-2">
                <Server className="w-4 h-4 text-[var(--accent-primary)]" />
                MongoDB Topologies Probe
              </h3>
              <button
                onClick={() => setProbeOpen(false)}
                className="text-[var(--text-secondary)] hover:text-[var(--accent-dark)] font-bold text-base"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] mb-4">
              Real-time ping probes across all 3 configured academic topologies:
            </p>

            {probing ? (
              <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                <div className="loading-spinner mb-2" />
                <div>Probing standalone, replica set, and mongos instances...</div>
              </div>
            ) : probeData ? (
              <div className="space-y-3">
                {/* Standalone */}
                <div className="p-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-md">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-[var(--text-primary)]">Standalone Node (Port 27017)</span>
                    {probeData.standalone.available ? (
                      <span className="badge badge-green flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Online
                      </span>
                    ) : (
                      <span className="badge badge-red flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Offline
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] font-mono">
                    {probeData.standalone.available
                      ? `Connected • Primary: ${probeData.standalone.primary}`
                      : probeData.standalone.error}
                  </div>
                </div>

                {/* Replica Set */}
                <div className="p-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-md">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-[var(--text-primary)]">Replica Set rs0 (Ports 27018-27020)</span>
                    {probeData.replica_set.available ? (
                      <span className="badge badge-green flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Active Primary
                      </span>
                    ) : (
                      <span className="badge badge-red flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Offline
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] font-mono">
                    {probeData.replica_set.available
                      ? `Replica Set: ${probeData.replica_set.set_name} • Primary: ${probeData.replica_set.primary}`
                      : probeData.replica_set.error}
                  </div>
                </div>

                {/* Sharded Cluster */}
                <div className="p-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-md">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs text-[var(--text-primary)]">Sharded Cluster mongos (Port 27050)</span>
                    {probeData.sharded.available ? (
                      <span className="badge badge-green flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> mongos Active
                      </span>
                    ) : (
                      <span className="badge badge-red flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Offline
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] font-mono">
                    {probeData.sharded.available
                      ? `Router grid active (isdbgrid: ${probeData.sharded.is_mongos})`
                      : probeData.sharded.error}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="modal-actions mt-5">
              <button
                className="btn btn-sm btn-primary"
                onClick={probeTopologies}
                disabled={probing}
              >
                Re-Probe
              </button>
              <button
                className="btn btn-sm"
                onClick={() => setProbeOpen(false)}
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
