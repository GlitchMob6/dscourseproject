import { useState, useEffect } from 'react';
import {
  Play,
  HelpCircle,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { QueryAnalysis } from '../types';
import { apiGet, apiPost } from '../api';
import { useToast } from '../context/ToastContext';

export const QueriesPage: React.FC = () => {
  const [examples, setExamples] = useState<any[]>([]);
  const [customJson, setCustomJson] = useState(
    JSON.stringify({ category: 'Computer Science' }, null, 2)
  );
  const [queryName, setQueryName] = useState('Targeted Shard Query');
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<QueryAnalysis | null>(null);
  const [showRawPlan, setShowRawPlan] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    const fetchExamples = async () => {
      try {
        const res = await apiGet('/queries/examples');
        setExamples(res.queries || []);
      } catch {
        // Fallback
      }
    };
    fetchExamples();
  }, []);

  const handleSelectExample = (ex: any) => {
    setQueryName(ex.name);
    setCustomJson(JSON.stringify(ex.filter, null, 2));
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnalyzing(true);
    setResult(null);
    try {
      let parsedFilter: any;
      try {
        parsedFilter = JSON.parse(customJson);
      } catch (err: any) {
        showToast('Invalid JSON query filter: ' + err.message, 'error');
        setAnalyzing(false);
        return;
      }

      const data = await apiPost('/queries/analyze', {
        filter: parsedFilter,
        name: queryName,
      });

      if (data.error) {
        showToast(data.error, 'error');
        setResult({ ...data, routingType: 'SCATTER_GATHER' });
      } else {
        setResult(data);
        showToast('Query explain plan parsed successfully', 'success');
      }
    } catch (err: any) {
      showToast(err.message || 'Analysis error', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="page-header">
        <h2>Distributed Query Analyzer (explain)</h2>
        <p>
          Analyze mongos execution plans to differentiate efficient single-shard targeted queries from broadcast scatter-gather operations.
        </p>
      </div>

      {/* Preset Query Pickers */}
      <div className="card">
        <div className="card-header">
          <span className="card-title flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            Preset Academic Scenarios
          </span>
        </div>

        <div className="grid-2">
          {examples.map((ex, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelectExample(ex)}
              className="p-3 text-left rounded bg-[var(--bg-primary)] hover:bg-[var(--bg-hover)] border border-[var(--border)] transition space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-white">
                  {ex.name}
                </span>
                <span
                  className={`badge ${
                    ex.name.startsWith('Targeted')
                      ? 'badge-green'
                      : 'badge-yellow'
                  }`}
                >
                  {ex.name.startsWith('Targeted') ? 'TARGETED' : 'SCATTER-GATHER'}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                {ex.description}
              </p>
              <div className="font-mono text-[10px] text-cyan-400 truncate pt-1">
                {JSON.stringify(ex.filter)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Query Input Editor */}
      <div className="card">
        <form onSubmit={handleAnalyze} className="space-y-3">
          <div className="form-group">
            <label className="form-label">Query Label / Name</label>
            <input
              type="text"
              className="form-input"
              value={queryName}
              onChange={(e) => setQueryName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label flex items-center justify-between">
              <span>MongoDB Filter Object (JSON)</span>
              <span className="text-[11px] text-[var(--text-muted)] font-mono">
                Collection: library_db.books
              </span>
            </label>
            <textarea
              rows={4}
              className="form-input font-mono text-xs"
              value={customJson}
              onChange={(e) => setCustomJson(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={analyzing}
            className="btn btn-primary"
          >
            <Play className="w-4 h-4" />
            <span>{analyzing ? 'Analyzing Plan...' : 'Run Query Analysis (explain)'}</span>
          </button>
        </form>
      </div>

      {/* Analysis Result Section */}
      {result && (
        <div className="space-y-6">
          {result.error ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-400">
              <strong>Query Planning Error:</strong> {result.error}
            </div>
          ) : (
            <div className="card space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    {result.queryName}
                  </h3>
                  <div className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                    Filter: {JSON.stringify(result.query)}
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`badge text-sm px-3 py-1 font-bold ${
                      result.routingType === 'TARGETED'
                        ? 'badge-green'
                        : 'badge-yellow'
                    }`}
                  >
                    {result.routingType === 'TARGETED'
                      ? '⚡ TARGETED ROUTING'
                      : '📡 SCATTER-GATHER BROADCAST'}
                  </span>
                </div>
              </div>

              {/* Execution Metrics Cards */}
              <div className="grid-4 pt-2">
                <div className="p-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded">
                  <div className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">
                    Shards Contacted
                  </div>
                  <div className="text-lg font-bold text-white font-mono mt-1">
                    {result.shardsInvolved?.length || 0}
                  </div>
                  <div className="text-[10px] text-cyan-400 font-mono truncate">
                    {result.shardsInvolved?.join(', ') || 'N/A'}
                  </div>
                </div>

                <div className="p-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded">
                  <div className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">
                    Execution Time
                  </div>
                  <div className="text-lg font-bold text-emerald-400 font-mono mt-1">
                    {result.executionStats?.executionTimeMillis ?? '—'} ms
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">
                    mongos + shard roundtrip
                  </div>
                </div>

                <div className="p-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded">
                  <div className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">
                    Docs Examined
                  </div>
                  <div className="text-lg font-bold text-white font-mono mt-1">
                    {result.executionStats?.totalDocsExamined ?? '—'}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">
                    Returned: {result.executionStats?.nReturned ?? '—'}
                  </div>
                </div>

                <div className="p-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded">
                  <div className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">
                    Winning Stage
                  </div>
                  <div className="text-lg font-bold text-purple-400 font-mono mt-1">
                    {result.stage}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)]">
                    Query planner stage
                  </div>
                </div>
              </div>

              {/* Plain-English Explanation */}
              <div className="p-4 bg-[var(--bg-primary)] border border-[var(--border)] rounded-md">
                <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5" />
                  mongos Router Architectural Decision:
                </div>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {result.explanation}
                </p>
              </div>

              {/* Raw Explain Plan Accordion */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowRawPlan(!showRawPlan)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white"
                >
                  {showRawPlan ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                  <span>Toggle Raw explain() Execution Plan</span>
                </button>

                {showRawPlan && (
                  <div className="mt-2 json-viewer">
                    {JSON.stringify(result.rawPlan, null, 2)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Explainer Panel */}
      <div className="info-panel">
        <h4>Targeted vs Scatter-Gather Queries in Sharded Clusters</h4>
        <p>
          When an application executes a query through a mongos router, mongos inspects the query filter against its internal
          chunk cache. If the query includes the shard key prefix (e.g. <code>category</code>), mongos calculates the exact shard
          holding that range and performs a <strong>Targeted Query</strong>. If the filter omits the shard key (e.g. querying by <code>author</code>),
          mongos must perform a <strong>Scatter-Gather</strong> by broadcasting to all shards in the cluster, consuming unnecessary network and CPU resources.
        </p>
      </div>
    </div>
  );
};
