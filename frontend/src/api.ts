const API_BASE = '/api';

export async function apiFetch<T = any>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API Error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function apiGet<T = any>(path: string): Promise<T> {
  return apiFetch<T>(path);
}

export async function apiPost<T = any>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiPut<T = any>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'PUT',
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiDelete<T = any>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: 'DELETE' });
}

// Poll a job until it completes
export async function pollJob(jobId: string, intervalMs = 2000, maxAttempts = 60): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const job = await apiGet(`/jobs/${jobId}`);
      if (job && !job.error) {
        if (job.status === 'completed') return job;
        if (job.status === 'failed') throw new Error(job.error || 'Job failed');
      }
    } catch (err: any) {
      // Fallback for older route
      try {
        const fallbackJob = await apiGet(`/benchmarks/job/${jobId}`);
        if (fallbackJob.status === 'completed') return fallbackJob;
        if (fallbackJob.status === 'failed') throw new Error(fallbackJob.error || 'Job failed');
      } catch {
        // If neither responds, continue loop until maxAttempts
      }
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  throw new Error('Job polling timed out');
}
