import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Bell,
  Send,
  Layers,
  Trash2,
  Eye,
  Radio,
  Search,
  RefreshCw,
  Server,
} from 'lucide-react';
import {
  notificationsApi,
  NotificationDto,
  NotificationChannel,
  NotificationProvider,
} from '../../../core/api/services/notificationsApi';
import { extractApiServiceError } from '../../../core/api/envelope';
import { sanitizeString } from '../../../utils/sanitize';
import { Button } from '../../../components/ui/Button/Button';
import { Input } from '../../../components/ui/Input/Input';
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

// Form Schemas
const sendSingleSchema = z.object({
  recipient: z.string().min(1, 'Recipient is required'),
  channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP', 'WEBHOOK']),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Notification body is required'),
  provider: z.enum(['SENDGRID', 'TWILIO', 'META_CLOUD', 'FCM', 'MOCK']),
  dryRun: z.boolean().default(true),
});

type SendSingleFormValues = z.infer<typeof sendSingleSchema>;

const batchSchema = z.object({
  recipients: z.string().min(1, 'Comma or newline separated recipients required'),
  channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP', 'WEBHOOK']),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  dryRun: z.boolean().default(true),
});

type BatchFormValues = z.infer<typeof batchSchema>;

const webhookSchema = z.object({
  provider: z.string().min(1, 'Provider is required'),
  payloadJson: z.string().min(2, 'Valid JSON payload is required'),
});

type WebhookFormValues = z.infer<typeof webhookSchema>;

export const NotificationsTab: React.FC = () => {
  const queryClient = useQueryClient();

  const [searchRecipient, setSearchRecipient] = useState('');
  const [selectedNotif, setSelectedNotif] = useState<NotificationDto | null>(null);
  const [lookupId, setLookupId] = useState('');
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // 1. Fetch Sent Notifications
  const {
    data: notifications = [],
    isLoading: isNotifsLoading,
    isRefetching,
    refetch,
    error: queryError,
  } = useQuery({
    queryKey: ['explorer-notifications'],
    queryFn: async () => {
      const res = await notificationsApi.list();
      return res.data;
    },
  });

  // 2. Fetch Provider Routing Config
  const {
    data: providerConfig,
    isLoading: isConfigLoading,
    refetch: refetchConfig,
  } = useQuery({
    queryKey: ['explorer-notifications-config'],
    queryFn: async () => {
      const res = await notificationsApi.getProviderConfig();
      return res.data;
    },
  });

  // 3. Single Notification Form
  const {
    register: registerSingle,
    handleSubmit: handleSingleSubmit,
    reset: resetSingleForm,
    formState: { errors: singleErrors, isSubmitting: isSendingSingle },
  } = useForm<SendSingleFormValues>({
    resolver: zodResolver(sendSingleSchema),
    defaultValues: {
      recipient: 'admin@apex.health',
      channel: 'EMAIL',
      subject: 'Critical Telemetry Alert: Anomaly Detected',
      body: 'Continuous hemodynamic telemetry threshold exceeded in ICU Ward B.',
      provider: 'SENDGRID',
      dryRun: true,
    },
  });

  const sendSingleMutation = useMutation({
    mutationFn: async (values: SendSingleFormValues) => {
      return notificationsApi.send({
        recipient: sanitizeString(values.recipient),
        channel: values.channel as NotificationChannel,
        subject: sanitizeString(values.subject),
        body: sanitizeString(values.body),
        provider: values.provider as NotificationProvider,
        dryRun: values.dryRun,
      });
    },
    onSuccess: (res) => {
      toast.success(
        res.data.isDryRun
          ? `Simulated notification sent to ${res.data.recipient}`
          : `Dispatched notification to ${res.data.recipient}`
      );
      queryClient.invalidateQueries({ queryKey: ['explorer-notifications'] });
      resetSingleForm();
      setActionError(null);
    },
    onError: (err) => {
      const apiErr = extractApiServiceError(err);
      setActionError(apiErr.message);
      toast.error(`Dispatch failed: ${apiErr.message}`);
    },
  });

  // 4. Batch Notification Form
  const {
    register: registerBatch,
    handleSubmit: handleBatchSubmit,
    reset: resetBatchForm,
    formState: { errors: batchErrors, isSubmitting: isSendingBatch },
  } = useForm<BatchFormValues>({
    resolver: zodResolver(batchSchema),
    defaultValues: {
      recipients: 'doctor1@apex.health\ndoctor2@apex.health\nnurse1@apex.health',
      channel: 'EMAIL',
      subject: 'System Maintenance Notification',
      body: 'Scheduled EHR maintenance starting at 02:00 AM UTC.',
      dryRun: true,
    },
  });

  const sendBatchMutation = useMutation({
    mutationFn: async (values: BatchFormValues) => {
      const list = values.recipients
        .split(/[\n,]/)
        .map((r) => sanitizeString(r))
        .filter(Boolean);
      const items = list.map((recipient) => ({
        recipient,
        channel: values.channel as NotificationChannel,
        subject: sanitizeString(values.subject),
        body: sanitizeString(values.body),
        dryRun: values.dryRun,
      }));
      return notificationsApi.sendBatch(items, values.dryRun);
    },
    onSuccess: (res) => {
      toast.success(`Batch processed: ${res.data.sentCount} items dispatched!`);
      queryClient.invalidateQueries({ queryKey: ['explorer-notifications'] });
      setIsBatchModalOpen(false);
      resetBatchForm();
    },
    onError: (err) => {
      const apiErr = extractApiServiceError(err);
      toast.error(`Batch dispatch failed: ${apiErr.message}`);
    },
  });

  // 5. Clear DRY-Run Outbox
  const clearOutboxMutation = useMutation({
    mutationFn: async () => {
      return notificationsApi.clearDryRunOutbox();
    },
    onSuccess: (res) => {
      toast.success(res.data.message || 'DRY-run outbox cleared!');
      queryClient.invalidateQueries({ queryKey: ['explorer-notifications'] });
    },
    onError: (err) => {
      const apiErr = extractApiServiceError(err);
      toast.error(`Outbox clear failed: ${apiErr.message}`);
    },
  });

  // 6. Simulate Webhook Ingestion
  const {
    register: registerWebhook,
    handleSubmit: handleWebhookSubmit,
    reset: resetWebhookForm,
    formState: { errors: webhookErrors, isSubmitting: isSimulatingWebhook },
  } = useForm<WebhookFormValues>({
    resolver: zodResolver(webhookSchema),
    defaultValues: {
      provider: 'sendgrid',
      payloadJson: JSON.stringify(
        {
          event: 'delivered',
          email: 'admin@apex.health',
          timestamp: Math.floor(Date.now() / 1000),
          sg_message_id: 'sg_msg_982138120',
        },
        null,
        2
      ),
    },
  });

  const simulateWebhookMutation = useMutation({
    mutationFn: async (values: WebhookFormValues) => {
      const parsed = JSON.parse(values.payloadJson);
      return notificationsApi.simulateWebhook(sanitizeString(values.provider), parsed);
    },
    onSuccess: (res) => {
      toast.success(`Webhook ingested by provider: ${res.data.provider}`);
      setIsWebhookModalOpen(false);
      resetWebhookForm();
    },
    onError: (err) => {
      const apiErr = extractApiServiceError(err);
      toast.error(`Webhook ingestion failed: ${apiErr.message}`);
    },
  });

  // Lookup Specific Notification
  const handleLookup = async () => {
    if (!lookupId.trim()) return;
    try {
      const res = await notificationsApi.getById(sanitizeString(lookupId));
      setSelectedNotif(res.data);
      toast.info(`Found notification #${res.data.id}`);
    } catch (err) {
      const apiErr = extractApiServiceError(err);
      toast.error(`Not found: ${apiErr.message}`);
    }
  };

  const filteredNotifs = notifications.filter((n) => {
    if (!searchRecipient) return true;
    const q = searchRecipient.toLowerCase();
    return (
      n.recipient.toLowerCase().includes(q) ||
      n.subject.toLowerCase().includes(q) ||
      n.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className={styles.tabContainer}>
      {actionError && (
        <Alert variant="error" title="Action Error">
          {actionError}
        </Alert>
      )}

      {queryError && (
        <Alert variant="error" title="Failed to Load Notifications">
          {extractApiServiceError(queryError).message}
        </Alert>
      )}

      {/* Top Routing Config & Outbox Controls Card */}
      <div className={styles.cardsGrid}>
        <div className={styles.cardItem}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <Radio size={16} /> Active Channel Provider Routing
            </div>
            <Button variant="ghost" size="sm" onClick={() => refetchConfig()}>
              <RefreshCw size={13} className={isConfigLoading ? 'animate-spin' : ''} />
            </Button>
          </div>

          <div className={styles.cardMeta}>
            <div>
              <strong>Email Provider:</strong>{' '}
              {providerConfig?.defaultChannelRouting?.EMAIL || 'SENDGRID'} &bull; Primary
            </div>
            <div>
              <strong>SMS Gateway:</strong>{' '}
              {providerConfig?.defaultChannelRouting?.SMS || 'TWILIO'} &bull; Active
            </div>
            <div>
              <strong>In-App &amp; Push:</strong> FCM &amp; WebSockets &bull; Connected
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 8 }}>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Trash2 size={14} />}
              isLoading={clearOutboxMutation.isPending}
              onClick={() => clearOutboxMutation.mutate()}
            >
              Clear DRY-Run Outbox
            </Button>

            <Button
              variant="outline"
              size="sm"
              leftIcon={<Server size={14} />}
              onClick={() => setIsWebhookModalOpen(true)}
            >
              Simulate Webhook
            </Button>

            <Button
              variant="primary"
              size="sm"
              leftIcon={<Layers size={14} />}
              onClick={() => setIsBatchModalOpen(true)}
            >
              Batch Dispatch
            </Button>
          </div>
        </div>

        {/* Quick UUID Lookup Card */}
        <div className={styles.cardItem}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <Search size={16} /> Query Notification by UUID
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
            Look up exact delivery receipts, provider message IDs, and failure reasons.
          </p>

          <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
            <input
              className={styles.formInput}
              placeholder="UUID (e.g. notif_101)"
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              style={{ flex: 1 }}
            />
            <Button variant="primary" size="sm" onClick={handleLookup}>
              Lookup
            </Button>
          </div>
        </div>
      </div>

      {/* Dispatch Single Notification Form */}
      <div className={styles.cardItem} style={{ marginTop: 8 }}>
        <div className={styles.cardTitle}>
          <Send size={16} /> Dispatch Single Notification
        </div>

        <form
          className={styles.modalForm}
          onSubmit={handleSingleSubmit((data) => sendSingleMutation.mutate(data))}
        >
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Recipient (Email / Phone) *</label>
              <input
                className={styles.formInput}
                placeholder="user@example.com"
                {...registerSingle('recipient')}
              />
              {singleErrors.recipient && (
                <span className={styles.formError}>{singleErrors.recipient.message}</span>
              )}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Channel *</label>
              <select className={styles.formSelect} {...registerSingle('channel')}>
                <option value="EMAIL">EMAIL</option>
                <option value="SMS">SMS</option>
                <option value="WHATSAPP">WHATSAPP</option>
                <option value="PUSH">PUSH</option>
                <option value="IN_APP">IN_APP</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Provider Gateway</label>
              <select className={styles.formSelect} {...registerSingle('provider')}>
                <option value="SENDGRID">SENDGRID</option>
                <option value="TWILIO">TWILIO</option>
                <option value="META_CLOUD">META_CLOUD</option>
                <option value="FCM">FCM</option>
                <option value="MOCK">MOCK</option>
              </select>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Subject *</label>
            <input
              className={styles.formInput}
              placeholder="Notification Subject..."
              {...registerSingle('subject')}
            />
            {singleErrors.subject && (
              <span className={styles.formError}>{singleErrors.subject.message}</span>
            )}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Message Body *</label>
            <textarea
              className={styles.formTextarea}
              placeholder="Message body content..."
              {...registerSingle('body')}
            />
            {singleErrors.body && (
              <span className={styles.formError}>{singleErrors.body.message}</span>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" {...registerSingle('dryRun')} />
              <span>Simulate in DRY-RUN mode (do not trigger external provider billing)</span>
            </label>

            <Button type="submit" variant="primary" isLoading={isSendingSingle} leftIcon={<Send size={14} />}>
              Send Notification
            </Button>
          </div>
        </form>
      </div>

      {/* Notifications History Table */}
      <div className={styles.sectionHeader} style={{ marginTop: 12 }}>
        <div className={styles.searchFilterRow}>
          <Input
            placeholder="Search sent log by recipient..."
            value={searchRecipient}
            onChange={(e) => setSearchRecipient(e.target.value)}
            style={{ maxWidth: 280 }}
          />
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
      </div>

      {isNotifsLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Spinner size={32} />
        </div>
      ) : filteredNotifs.length === 0 ? (
        <div className={styles.emptyState}>
          <Bell size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
          <div>No notifications logged. Dispatch a notification above to test delivery.</div>
        </div>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Recipient</TableHeaderCell>
              <TableHeaderCell>Channel</TableHeaderCell>
              <TableHeaderCell>Subject</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Mode</TableHeaderCell>
              <TableHeaderCell>Sent At</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredNotifs.map((n) => (
              <TableRow key={n.id}>
                <TableCell>
                  <strong>{n.recipient}</strong>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{n.id}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="neutral">{n.channel}</Badge>
                </TableCell>
                <TableCell style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {n.subject}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={n.status === 'DELIVERED' || n.status === 'SENT' ? 'success' : 'warning'}
                    withDot
                  >
                    {n.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {n.isDryRun ? <Badge variant="warning">DRY-RUN</Badge> : <Badge variant="primary">LIVE</Badge>}
                </TableCell>
                <TableCell>{n.sentAt || n.createdAt ? new Date(n.sentAt || n.createdAt).toLocaleTimeString() : 'N/A'}</TableCell>
                <TableCell>
                  <div className={styles.actionsCell}>
                    <button
                      type="button"
                      className={styles.actionIconBtn}
                      title="View Details"
                      onClick={() => setSelectedNotif(n)}
                    >
                      <Eye size={13} />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Batch Notification Modal */}
      <Modal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        title="High-Throughput Batch Notification Dispatch"
      >
        <form
          className={styles.modalForm}
          onSubmit={handleBatchSubmit((data) => sendBatchMutation.mutate(data))}
        >
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Recipients (One per line or comma-separated) *</label>
            <textarea
              className={styles.formTextarea}
              placeholder="user1@example.com&#10;user2@example.com"
              {...registerBatch('recipients')}
            />
            {batchErrors.recipients && (
              <span className={styles.formError}>{batchErrors.recipients.message}</span>
            )}
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Channel</label>
              <select className={styles.formSelect} {...registerBatch('channel')}>
                <option value="EMAIL">EMAIL</option>
                <option value="SMS">SMS</option>
                <option value="PUSH">PUSH</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Subject</label>
              <input className={styles.formInput} {...registerBatch('subject')} />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Message Body</label>
            <textarea className={styles.formTextarea} {...registerBatch('body')} />
          </div>

          <div className={styles.modalFooter}>
            <Button type="button" variant="outline" onClick={() => setIsBatchModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSendingBatch}>
              Send Batch
            </Button>
          </div>
        </form>
      </Modal>

      {/* Webhook Simulator Modal */}
      <Modal
        isOpen={isWebhookModalOpen}
        onClose={() => setIsWebhookModalOpen(false)}
        title="Simulate Provider Webhook Callback"
      >
        <form
          className={styles.modalForm}
          onSubmit={handleWebhookSubmit((data) => simulateWebhookMutation.mutate(data))}
        >
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Provider Route Segment *</label>
            <input
              className={styles.formInput}
              placeholder="e.g. sendgrid, twilio, stripe"
              {...registerWebhook('provider')}
            />
            {webhookErrors.provider && (
              <span className={styles.formError}>{webhookErrors.provider.message}</span>
            )}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Webhook Event Payload (JSON) *</label>
            <textarea
              className={styles.formTextarea}
              style={{ minHeight: 140, fontFamily: 'monospace', fontSize: 12 }}
              {...registerWebhook('payloadJson')}
            />
            {webhookErrors.payloadJson && (
              <span className={styles.formError}>{webhookErrors.payloadJson.message}</span>
            )}
          </div>

          <div className={styles.modalFooter}>
            <Button type="button" variant="outline" onClick={() => setIsWebhookModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSimulatingWebhook}>
              Post Webhook
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        isOpen={Boolean(selectedNotif)}
        onClose={() => setSelectedNotif(null)}
        title={`Notification Details: ${selectedNotif?.id}`}
      >
        {selectedNotif && (
          <div className={styles.modalForm}>
            <div className={styles.codeBlock}>
              <pre>{JSON.stringify(selectedNotif, null, 2)}</pre>
            </div>
            <div className={styles.modalFooter}>
              <Button variant="outline" onClick={() => setSelectedNotif(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
