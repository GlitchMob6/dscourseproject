import { useState } from 'react';
import {
  Gauge,
  Play,
  Database,
  Download,
  CheckCircle2,
  Clock,
  Zap,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { apiPost, pollJob } from '../api';
import { useToast } from '../context/ToastContext';

export const BenchmarksPage: React.FC = () => {
  // Benchmark setup
  const [datasetSize, setDatasetSize] = useState<number>(500);
  const [testStandalone, setTestStandalone] = useState(true);
  const [testReplicaSet, setTestReplicaSet] = useState(true);
  const [testSharded, setTestSharded] = useState(true);
  const [running, setRunning] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<any | null>(null);

  // Synthetic generation setup
  const [genCount, setGenCount] = useState<number>(500);
  const [clearExisting, setClearExisting] = useState(false);
  const [generating, setGenerating] = useState(false);

  const { showToast } = useToast();

  const handleGenerateData = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    try {
      showToast(`Generating ${genCount} books...`, 'info');
      const res = await apiPost('/benchmarks/generate-data', {
        count: genCount,
        clearExisting,
      });
      if (res.success) {
        showToast(res.message, 'success');
      } else {
        showToast(res.message, 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Generation failed', 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleRunBenchmark = async (e: React.FormEvent) => {
    e.preventDefault();
    const envs: string[] = [];
    if (testStandalone) envs.push('standalone');
    if (testReplicaSet) envs.push('replica_set');
    if (testSharded) envs.push('sharded');

    if (envs.length === 0) {
      showToast('Select at least one environment to benchmark', 'error');
      return;
    }

    setRunning(true);
    setBenchmarkResult(null);

    try {
      showToast('Starting cross-architecture performance benchmark...', 'info');
      const startRes = await apiPost('/benchmarks/run', {
        datasetSize,
        environments: envs,
      });

      const job = await pollJob(startRes.job_id, 2000, 60);
      setBenchmarkResult(job.result);
      showToast('Benchmark run completed successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Benchmark run failed', 'error');
    } finally {
      setRunning(false);
    }
  };

  const exportCsv = () => {
    if (!benchmarkResult?.results) return;
    const headers = [
      'Architecture',
      'Status',
      'Dataset Size',
      'Insert Time (s)',
      'Throughput (docs/s)',
      'Avg Insert (ms)',
      'Point Query (ms)',
      'Range Query (ms)',
    ];
    const rows = benchmarkResult.results.map((r: any) => [
      `"${r.architecture}"`,
      r.status,
      r.datasetSize || '',
      r.insertTimeSec || '',
      r.throughputDocsPerSec || '',
      r.avgInsertLatencyMs || '',
      r.pointQueryLatencyMs || '',
      r.rangeQueryLatencyMs || '',
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e: any[]) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `mongodb_benchmark_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Prepare chart data
  const throughputData =
    benchmarkResult?.results
      ?.filter((r: any) => r.status === 'COMPLETED')
      .map((r: any) => ({
        name: r.architecture.split(' ')[0],
        'Throughput (docs/sec)': r.throughputDocsPerSec,
      })) || [];

  const queryLatencyData =
    benchmarkResult?.results
      ?.filter((r: any) => r.status === 'COMPLETED')
      .map((r: any) => ({
        name: r.architecture.split(' ')[0],
        'Point Query (ms)': r.pointQueryLatencyMs,
        'Range Query (ms)': r.rangeQueryLatencyMs,
      })) || [];

  return (
    <div className="space-y-8">
      <div className="page-header flex items-center justify-between">
        <div>
          <h2>Performance Benchmarking & Data Generation</h2>
          <p>
            Quantitatively evaluate write throughput, point-query latency, and scatter-gather range overhead across all 3 architectures.
          </p>
        </div>
        {benchmarkResult && (
          <button onClick={exportCsv} className="btn btn-sm">
            <Download className="w-4 h-4 text-cyan-400" />
            <span>Export CSV</span>
          </button>
        )}
      </div>

      {/* Top 2 Action Cards: Synthetic Data Gen & Benchmark Controls */}
      <div className="grid-2">
        {/* Synthetic Dataset Generator */}
        <div className="card">
          <div className="card-header">
            <span className="card-title flex items-center gap-2 text-[var(--accent-primary)] font-serif">
              <Database className="w-4 h-4" />
              Dataset Generator (Seed: 42)
            </span>
            <span className="badge badge-purple">Reproducible</span>
          </div>

          <form onSubmit={handleGenerateData} className="space-y-3">
            <div className="form-group">
              <label className="form-label">Number of Books to Generate</label>
              <select
                className="form-input"
                value={genCount}
                onChange={(e) => setGenCount(Number(e.target.value))}
              >
                <option value={100}>100 records (Quick smoke test)</option>
                <option value={500}>500 records (Standard benchmark)</option>
                <option value={1000}>1,000 records (Recommended)</option>
                <option value={2000}>2,000 records (Deep partition spread)</option>
                <option value={5000}>5,000 records (Stress test)</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-1 pb-2">
              <input
                type="checkbox"
                id="clearCheck"
                checked={clearExisting}
                onChange={(e) => setClearExisting(e.target.checked)}
                className="cursor-pointer"
              />
              <label
                htmlFor="clearCheck"
                className="text-xs text-[var(--text-secondary)] cursor-pointer"
              >
                Clear existing books collection before inserting
              </label>
            </div>

            <button
              type="submit"
              disabled={generating}
              className="btn btn-primary w-full justify-center"
            >
              {generating ? 'Generating Books...' : 'Populate Active Database'}
            </button>
          </form>
        </div>

        {/* Benchmark Test Runner */}
        <div className="card">
          <div className="card-header">
            <span className="card-title flex items-center gap-2 text-[var(--accent-primary)] font-serif">
              <Gauge className="w-4 h-4" />
              Cross-Architecture Benchmark Suite
            </span>
          </div>

          <form onSubmit={handleRunBenchmark} className="space-y-3">
            <div className="form-group">
              <label className="form-label">Dataset Size for Benchmark</label>
              <select
                className="form-input"
                value={datasetSize}
                onChange={(e) => setDatasetSize(Number(e.target.value))}
              >
                <option value={250}>250 documents per environment</option>
                <option value={500}>500 documents per environment</option>
                <option value={1000}>1,000 documents per environment</option>
              </select>
            </div>

            <div className="space-y-1.5 pt-1 pb-2">
              <label className="form-label">Select Architectures to Probe:</label>
              <div className="flex flex-wrap gap-4 text-xs text-[var(--text-secondary)]">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={testStandalone}
                    onChange={(e) => setTestStandalone(e.target.checked)}
                  />
                  <span>Standalone (27017)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={testReplicaSet}
                    onChange={(e) => setTestReplicaSet(e.target.checked)}
                  />
                  <span>Replica Set (rs0)</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={testSharded}
                    onChange={(e) => setTestSharded(e.target.checked)}
                  />
                  <span>Sharded Cluster (mongos)</span>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={running}
              className="btn btn-primary w-full justify-center"
            >
              <Play className="w-4 h-4" />
              <span>{running ? 'Running Benchmark Suite...' : 'Start Comparative Benchmark'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Loading Progress State */}
      {running && (
        <div className="card py-16 text-center text-xs text-[var(--text-muted)]">
          <div className="loading-spinner mb-3" />
          <div className="text-[var(--text-primary)] text-sm font-semibold font-serif mb-1">
            Executing Benchmark Across Architectures...
          </div>
          <p className="text-[var(--text-secondary)]">
            Running bulk inserts, point index lookups, and range scans in isolated <code>benchmark_db</code> instances.
          </p>
        </div>
      )}

      {/* Benchmark Results Display */}
      {benchmarkResult && (
        <div className="space-y-6">
          {/* Comparative Metrics Table */}
          <div className="card">
            <div className="card-header">
              <span className="card-title flex items-center gap-2 font-serif">
                <CheckCircle2 className="w-4 h-4 text-[var(--status-success)]" />
                Comparative Performance Metrics ({benchmarkResult.datasetSize} Docs)
              </span>
              <span className="text-xs text-[var(--text-muted)] font-mono">
                {new Date(benchmarkResult.completedAt).toLocaleTimeString()}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Architecture</th>
                    <th>Status</th>
                    <th>Insert Time</th>
                    <th>Write Throughput</th>
                    <th>Avg Insert Latency</th>
                    <th>Point Query (bookId)</th>
                    <th>Range Query (category)</th>
                  </tr>
                </thead>
                <tbody>
                  {benchmarkResult.results?.map((r: any, idx: number) => {
                    const isSuccess = r.status === 'COMPLETED';
                    return (
                      <tr key={idx}>
                        <td className="font-semibold text-[var(--text-primary)] font-serif">
                          {r.architecture}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              isSuccess ? 'badge-green' : 'badge-red'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="font-mono text-xs">
                          {isSuccess ? `${r.insertTimeSec}s` : '—'}
                        </td>
                        <td className="font-mono text-xs font-bold text-[var(--accent-primary)]">
                          {isSuccess ? `${r.throughputDocsPerSec} docs/s` : '—'}
                        </td>
                        <td className="font-mono text-xs">
                          {isSuccess ? `${r.avgInsertLatencyMs} ms` : '—'}
                        </td>
                        <td className="font-mono text-xs font-semibold text-[var(--status-success)]">
                          {isSuccess ? `${r.pointQueryLatencyMs} ms` : '—'}
                        </td>
                        <td className="font-mono text-xs font-semibold text-[var(--accent-gold)]">
                          {isSuccess ? `${r.rangeQueryLatencyMs} ms` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recharts Visualizations */}
          <div className="grid-2">
            {/* Throughput Bar Chart */}
            <div className="card">
              <div className="card-header">
                <span className="card-title flex items-center gap-2 font-serif">
                  <Zap className="w-4 h-4 text-[var(--accent-primary)]" />
                  Bulk Insert Throughput (Docs / Sec)
                </span>
              </div>

              {throughputData.length > 0 ? (
                <div className="h-64 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={throughputData}
                      margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#D8BFA4" />
                      <XAxis dataKey="name" stroke="#705641" fontSize={11} />
                      <YAxis stroke="#705641" fontSize={11} />
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
                      <Bar
                        dataKey="Throughput (docs/sec)"
                        fill="#6B3218"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="empty-state">
                  <p>No throughput data available.</p>
                </div>
              )}
            </div>

            {/* Query Latencies Comparison */}
            <div className="card">
              <div className="card-header">
                <span className="card-title flex items-center gap-2 font-serif">
                  <Clock className="w-4 h-4 text-[var(--accent-copper)]" />
                  Query Latencies Comparison (ms)
                </span>
              </div>

              {queryLatencyData.length > 0 ? (
                <div className="h-64 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={queryLatencyData}
                      margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#D8BFA4" />
                      <XAxis dataKey="name" stroke="#705641" fontSize={11} />
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
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10, color: '#2C1B12' }} />
                      <Bar
                        dataKey="Point Query (ms)"
                        fill="#C9A447"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="Range Query (ms)"
                        fill="#986039"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="empty-state">
                  <p>No query data available.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Benchmark Analysis Guide */}
      <div className="info-panel">
        <h4 className="font-serif text-[var(--accent-primary)]">Architectural Performance Insights</h4>
        <p>
          <strong>Standalone</strong> exhibits the lowest single-node write latency due to zero replication overhead or routing proxy hops.{' '}
          <strong>Replica Set</strong> incurs small oplog sync overhead on writes, but enables linear read scaling across secondaries.{' '}
          <strong>Sharded Cluster</strong> distributes storage volume and write lock concurrency horizontally across shards via mongos,
          providing near-linear scalability for large datasets at the trade-off of slight network routing overhead.
        </p>
      </div>
    </div>
  );
};
