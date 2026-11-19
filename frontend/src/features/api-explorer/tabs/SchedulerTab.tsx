import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, CalendarClock, RefreshCw, Play, Trash2 } from 'lucide-react';
import {
  schedulerApi,
  ScheduledJobDto,
} from '../../../core/api/services/schedulerApi';
import { extractApiServiceError } from '../../../core/api/envelope';
import { sanitizeString } from '../../../utils/sanitize';
import { Button } from '../../../components/ui/Button/Button';
import { Badge } from '../../../components/ui/Badge/Badge';
import { Spinner } from '../../../components/ui/Spinner/Spinner';
import { Modal } from '../../../components/ui/Modal/Modal';
import { Alert } from '../../../components/ui/Alert/Alert';
import { toast } from '../../../components/ui/Toast';
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
} from '../../../components/ui/Table/Table';
import styles from './Tabs.module.css';

// 5-part Cron Regex: min, hour, dom, mon, dow
const CRON_REGEX = /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/[0-9]+)\s+(\*|([0-9]|1[0-9]|2[0-3])|\*\/[0-9]+)\s+(\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/[0-9]+)\s+(\*|([1-9]|1[0-2])|\*\/[0-9]+)\s+(\*|([0-6])|\*\/[0-9]+)$/;

const createJobSchema = z.object({
  name: z.string().min(1, 'Job name is required'),
  cronExpression: z
    .string()
    .min(1, 'Cron expression is required')
    .refine((val) => CRON_REGEX.test(val.trim()), {
      message: 'Must be a valid 5-part cron expression (e.g. "0 * * * *" or "*/15 * * * *")',
    }),
  targetService: z.string().min(1, 'Target service is required'),
  targetEndpoint: z.string().min(1, 'Target endpoint is required'),
  enabled: z.boolean().default(true),
});

type CreateJobFormValues = z.infer<typeof createJobSchema>;

export const SchedulerTab: React.FC = () => {
  const queryClient = useQueryClient();

  const [jobToDelete, setJobToDelete] = useState<ScheduledJobDto | null>(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [triggeringJobId, setTriggeringJobId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // 1. Fetch Scheduled Jobs
  const {
    data: jobs = [],
    isLoading,
    isRefetching,
    refetch,
    error: queryError,
  } = useQuery({
    queryKey: ['explorer-scheduler-jobs'],
    queryFn: async () => {
      const res = await schedulerApi.listJobs();
      return res.data;
    },
  });

  // 2. Register Job Form
  const {
    register,
    handleSubmit,
    reset: resetRegisterForm,
    formState: { errors: registerErrors, isSubmitting: isRegistering },
  } = useForm<CreateJobFormValues>({
    resolver: zodResolver(createJobSchema),
    defaultValues: {
      name: '',
      cronExpression: '0 * * * *',
      targetService: 'orders',
      targetEndpoint: '/api/v1/orders/reconcile',
      enabled: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: CreateJobFormValues) => {
      return schedulerApi.createJob({
        name: sanitizeString(values.name),
        cronExpression: sanitizeString(values.cronExpression),
        targetService: sanitizeString(values.targetService),
        targetEndpoint: sanitizeString(values.targetEndpoint),
        enabled: values.enabled,
      });
    },
    onSuccess: (res) => {
      toast.success(`Cron job "${res.data.name}" registered!`);
      queryClient.invalidateQueries({ queryKey: ['explorer-scheduler-jobs'] });
      setIsRegisterModalOpen(false);
      resetRegisterForm();
      setActionError(null);
    },
    onError: (err) => {
      const apiErr = extractApiServiceError(err);
      setActionError(apiErr.message);
      toast.error(`Registration failed: ${apiErr.message}`);
    },
  });

  // 3. Trigger Job Execution
  const triggerMutation = useMutation({
    mutationFn: async (id: string) => {
      setTriggeringJobId(id);
      return schedulerApi.triggerJob(id);
    },
    onSuccess: () => {
      toast.success(`Job execution triggered successfully!`);
      queryClient.invalidateQueries({ queryKey: ['explorer-scheduler-jobs'] });
      setTriggeringJobId(null);
    },
    onError: (err) => {
      const apiErr = extractApiServiceError(err);
      toast.error(`Trigger failed: ${apiErr.message}`);
      setTriggeringJobId(null);
    },
  });

  // 4. Delete Job
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return schedulerApi.deleteJob(id);
    },
    onSuccess: () => {
      toast.success('Scheduled cron job deleted');
      queryClient.invalidateQueries({ queryKey: ['explorer-scheduler-jobs'] });
      setJobToDelete(null);
      setActionError(null);
    },
    onError: (err) => {
      const apiErr = extractApiServiceError(err);
      setActionError(apiErr.message);
      toast.error(`Delete failed: ${apiErr.message}`);
    },
  });

  return (
    <div className={styles.tabContainer}>
      {actionError && (
        <Alert variant="error" title="Action Error">
          {actionError}
        </Alert>
      )}

      {queryError && (
        <Alert variant="error" title="Failed to Load Scheduled Jobs">
          {extractApiServiceError(queryError).message}
        </Alert>
      )}

      {/* Header Controls */}
      <div className={styles.sectionHeader}>
        <div className={styles.searchFilterRow}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            leftIcon={<RefreshCw size={13} className={isRefetching ? 'animate-spin' : ''} />}
          >
            Refresh
          </Button>
        </div>

        <Button
          variant="primary"
          size="sm"
          leftIcon={<Plus size={14} />}
          onClick={() => {
            setActionError(null);
            setIsRegisterModalOpen(true);
          }}
        >
          Register Job
        </Button>
      </div>

      {/* Jobs Table */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Spinner size={32} />
        </div>
      ) : jobs.length === 0 ? (
        <div className={styles.emptyState}>
          <CalendarClock size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
          <div>No cron jobs registered. Click "Register Job" to schedule background routines.</div>
        </div>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Job Name</TableHeaderCell>
              <TableHeaderCell>Cron Expression</TableHeaderCell>
              <TableHeaderCell>Target Service</TableHeaderCell>
              <TableHeaderCell>Target Endpoint</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Last Run</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell>
                  <strong>{job.name}</strong>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{job.id}</div>
                </TableCell>
                <TableCell style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                  {job.cronExpression}
                </TableCell>
                <TableCell>{job.targetService}</TableCell>
                <TableCell style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {job.targetEndpoint}
                </TableCell>
                <TableCell>
                  <Badge variant={job.enabled ? 'success' : 'neutral'} withDot>
                    {job.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {job.lastRunAt ? new Date(job.lastRunAt).toLocaleTimeString() : 'Never run'}
                </TableCell>
                <TableCell>
                  <div className={styles.actionsCell}>
                    <button
                      type="button"
                      className={`${styles.actionIconBtn} ${styles.successIconBtn}`}
                      title="Trigger Immediate Execution"
                      disabled={triggeringJobId === job.id}
                      onClick={() => triggerMutation.mutate(job.id)}
                    >
                      <Play size={13} className={triggeringJobId === job.id ? 'animate-spin' : ''} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.actionIconBtn} ${styles.deleteIconBtn}`}
                      title="Delete Job"
                      onClick={() => setJobToDelete(job)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Register Job Modal */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="Register Scheduled Cron Job"
      >
        <form
          className={styles.modalForm}
          onSubmit={handleSubmit((data) => createMutation.mutate(data))}
        >
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Job Name *</label>
            <input
              className={styles.formInput}
              placeholder="e.g. Nightly Inventory Reconciliation"
              {...register('name')}
            />
            {registerErrors.name && (
              <span className={styles.formError}>{registerErrors.name.message}</span>
            )}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>5-Part Cron Expression *</label>
            <input
              className={styles.formInput}
              placeholder="e.g. 0 2 * * * (At 02:00 AM daily)"
              {...register('cronExpression')}
            />
            <span style={{ fontSize: 11, color: '#64748b' }}>
              Format: minute hour day-of-month month day-of-week
            </span>
            {registerErrors.cronExpression && (
              <span className={styles.formError}>{registerErrors.cronExpression.message}</span>
            )}
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Target Service *</label>
              <select className={styles.formSelect} {...register('targetService')}>
                <option value="orders">orders</option>
                <option value="inventory">inventory</option>
                <option value="transactions">transactions</option>
                <option value="notifications">notifications</option>
                <option value="config">config</option>
                <option value="iam">iam</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Target Endpoint *</label>
              <input
                className={styles.formInput}
                placeholder="/api/v1/orders/reconcile"
                {...register('targetEndpoint')}
              />
              {registerErrors.targetEndpoint && (
                <span className={styles.formError}>{registerErrors.targetEndpoint.message}</span>
              )}
            </div>
          </div>

          <div className={styles.modalFooter}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsRegisterModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isRegistering}>
              Register Cron Job
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Job Confirmation Modal */}
      <Modal
        isOpen={Boolean(jobToDelete)}
        onClose={() => setJobToDelete(null)}
        title="Confirm Job Deletion"
      >
        {jobToDelete && (
          <div className={styles.modalForm}>
            <p style={{ margin: 0, fontSize: 13, color: '#464555' }}>
              Are you sure you want to delete cron job <strong>{jobToDelete.name}</strong> ({jobToDelete.cronExpression})?
            </p>
            <div className={styles.modalFooter}>
              <Button variant="outline" onClick={() => setJobToDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                isLoading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(jobToDelete.id)}
              >
                Delete Job
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
