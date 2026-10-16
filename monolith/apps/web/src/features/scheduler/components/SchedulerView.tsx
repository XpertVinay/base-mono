import React, { useEffect, useState } from 'react';
import { ScheduledJobDto } from '@monolith/contracts';
import { apiClient } from '../../../shared/api/api-client.js';
import { useAuth } from '../../../shared/hooks/useAuth.js';
import { Clock, Play } from 'lucide-react';

export const SchedulerView: React.FC = () => {
  const { isAdmin } = useAuth();
  const [jobs, setJobs] = useState<ScheduledJobDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);

  const fetchJobs = async () => {
    const res = await apiClient.get<ScheduledJobDto[]>('/api/scheduler');
    if (res.success && res.data) {
      setJobs(res.data);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleTrigger = async (jobId: string, jobName: string) => {
    if (!isAdmin) {
      alert('ADMIN authorization required to manually trigger scheduled background jobs');
      return;
    }
    setLoading(true);
    const res = await apiClient.post<ScheduledJobDto>(`/api/scheduler/${jobId}/trigger`);
    if (res.success) {
      setTriggerMsg(`Job '${jobName}' triggered and completed execution!`);
      await fetchJobs();
    } else {
      alert(res.error?.message || 'Failed to trigger job');
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Clock size={22} color="var(--brand-primary)" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Background Scheduler & Cron Policies</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Autonomous job execution policies. Scheduler triggers application use cases across modules without containing duplicated domain logic (AGENTS.md §3).
        </p>
      </div>

      {triggerMsg && (
        <div style={{ padding: '12px 16px', background: 'var(--status-success-bg)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--status-success)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem' }}>
          {triggerMsg}
        </div>
      )}

      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>Registered Background Jobs ({jobs.length})</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {jobs.map(job => (
            <div
              key={job.id}
              style={{
                padding: '16px',
                background: 'rgba(15, 23, 42, 0.4)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)', fontSize: '0.95rem' }}>
                    {job.name}
                  </span>
                  <span className={`badge ${job.status === 'COMPLETED' ? 'badge-success' : 'badge-info'}`}>
                    {job.status}
                  </span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Schedule: <code>{job.cronExpression}</code> • Last Run: {job.lastRunAt ? new Date(job.lastRunAt).toLocaleTimeString() : 'Never'}
                </div>
              </div>

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => handleTrigger(job.id, job.name)}
                disabled={loading}
              >
                <Play size={14} /> Execute Now
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
