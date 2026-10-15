export interface ClusterStats {
  books: number | null;
  members: number | null;
  transactions: number | null;
  active_issues: number | null;
}

export interface HealthStatus {
  connected: boolean;
  mode: 'STANDALONE' | 'REPLICA_SET' | 'SHARDED' | 'UNKNOWN';
  uri: string;
  primary_host?: string;
  set_name?: string;
  is_primary?: boolean;
  hosts?: string[];
  msg?: string;
  stats: ClusterStats;
  error?: string;
}

export interface ConnectivityTopology {
  available: boolean;
  primary?: string;
  set_name?: string;
  is_mongos?: boolean;
  error?: string;
}

export interface ConnectivityStatus {
  standalone: ConnectivityTopology;
  replica_set: ConnectivityTopology;
  sharded: ConnectivityTopology;
}

export interface Book {
  bookId: string;
  title: string;
  author: string;
  category: string;
  totalCopies: number;
  availableCopies: number;
  addedAt?: string;
  activeIssues?: Transaction[];
}

export interface Member {
  memberId: string;
  name: string;
  department: string;
  registeredAt?: string;
  activeIssues?: number;
  history?: Transaction[];
}

export interface Transaction {
  transactionId: string;
  bookId: string;
  memberId: string;
  issueDate: string;
  returnDate?: string | null;
  status: 'ISSUED' | 'RETURNED';
}

export interface ReplicationMember {
  id: number;
  name: string;
  state: string;
  health: 'HEALTHY' | 'DOWN';
  uptime: number;
  optime: string;
  syncSourceHost?: string;
}

export interface ReplicationStatus {
  connected: boolean;
  setName: string;
  primary: string;
  members: ReplicationMember[];
  error?: string;
}

export interface ReplicationExperimentStep {
  step: number;
  title: string;
  status: 'success' | 'failed' | 'running';
  error?: string;
  [key: string]: any;
}

export interface ReplicationExperimentResult {
  steps: ReplicationExperimentStep[];
  testId?: string;
  completedAt?: string;
}

export interface ConsistencyResult {
  writeConcern: {
    w1: {
      label: string;
      min: number;
      max: number;
      avg: number;
      durability: string;
      latencies: number[];
    };
    wMajority: {
      label: string;
      min: number;
      max: number;
      avg: number;
      durability: string;
      latencies: number[];
    };
  };
  readPreference: Array<{
    mode: string;
    description: string;
    found: boolean;
    latencyMs: number;
  }>;
  completedAt: string;
  error?: string;
}

export interface ShardingStatus {
  connected: boolean;
  isMongos: boolean;
  shards?: Array<{ id: string; host: string; state: number }>;
  database?: { primaryShard: string; partitioned: boolean };
  collection?: { sharded: boolean; shardKey?: any; unique?: boolean };
  totalBooks?: number;
  distribution?: Array<{
    shard: string;
    count: number;
    sizeKB: number;
    percentage: number;
  }>;
  chunks?: Array<{ shard: string; min: string; max: string }>;
  error?: string;
  shardsError?: string;
  distributionError?: string;
}

export interface QueryAnalysis {
  query: any;
  queryName: string;
  routingType: 'TARGETED' | 'SCATTER_GATHER';
  stage: string;
  shardsInvolved: string[];
  totalShardsInCluster: number | string;
  executionStats: {
    nReturned: number | string;
    totalDocsExamined: number | string;
    totalKeysExamined: number | string;
    executionTimeMillis: number | string;
  };
  explanation: string;
  rawPlan?: any;
  error?: string;
}

export interface BenchmarkMetrics {
  bulk_insert_seconds?: number;
  inserts_per_second?: number;
  read_single_ms?: number;
  read_category_ms?: number;
  read_all_ms?: number;
  update_stock_ms?: number;
  error?: string;
}

export interface BenchmarkResult {
  environments: Record<string, BenchmarkMetrics>;
  dataset_size: number;
  timestamp: string;
}
