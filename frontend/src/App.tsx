import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { Layout } from './components/Layout';
import { OverviewPage } from './pages/OverviewPage';
import { BooksPage } from './pages/BooksPage';
import { MembersPage } from './pages/MembersPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { ReplicationPage } from './pages/ReplicationPage';
import { ConsistencyPage } from './pages/ConsistencyPage';
import { FailoverPage } from './pages/FailoverPage';
import { ShardingPage } from './pages/ShardingPage';
import { QueriesPage } from './pages/QueriesPage';
import { BenchmarksPage } from './pages/BenchmarksPage';

export function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<OverviewPage />} />
            <Route path="books" element={<BooksPage />} />
            <Route path="members" element={<MembersPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="replication" element={<ReplicationPage />} />
            <Route path="consistency" element={<ConsistencyPage />} />
            <Route path="failover" element={<FailoverPage />} />
            <Route path="sharding" element={<ShardingPage />} />
            <Route path="queries" element={<QueriesPage />} />
            <Route path="benchmarks" element={<BenchmarksPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
