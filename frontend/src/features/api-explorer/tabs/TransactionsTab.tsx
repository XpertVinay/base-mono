import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, CreditCard, RefreshCw, Eye, RotateCcw } from 'lucide-react';
import {
  transactionsApi,
  TransactionDto,
  PaymentGatewayType,
  TransactionStatus,
} from '../../../core/api/services/transactionsApi';
import { extractApiServiceError } from '../../../core/api/envelope';
import { sanitizeString, isValidUrl } from '../../../utils/sanitize';
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

// Zod Validation Schemas (Requirement R4)
const initiatePaymentSchema = z.object({
  amount: z.number().positive('Amount must be greater than 0'),
  currency: z.string().min(3).max(3).default('USD'),
  gateway: z.enum(['STRIPE', 'PAYPAL', 'RAZORPAY', 'MOCK']),
  orderId: z.string().optional(),
  returnUrl: z
    .string()
    .optional()
    .refine((val) => !val || isValidUrl(val), {
      message: 'Return URL must use secure http: or https: protocol',
    }),
});

type InitiatePaymentFormValues = z.infer<typeof initiatePaymentSchema>;

export const TransactionsTab: React.FC = () => {
  const queryClient = useQueryClient();

  const [gatewayFilter, setGatewayFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTxn, setSelectedTxn] = useState<TransactionDto | null>(null);
  const [txnToRefund, setTxnToRefund] = useState<TransactionDto | null>(null);
  const [isInitiateModalOpen, setIsInitiateModalOpen] = useState(false);
  const [refundReason, setRefundReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // 1. Fetch Transactions
  const {
    data: transactions = [],
    isLoading,
    isRefetching,
    refetch,
    error: queryError,
  } = useQuery({
    queryKey: ['explorer-transactions', gatewayFilter, statusFilter],
    queryFn: async () => {
      const params = {
        gateway: gatewayFilter !== 'all' ? (gatewayFilter as PaymentGatewayType) : undefined,
        status: statusFilter !== 'all' ? (statusFilter as TransactionStatus) : undefined,
      };
      const res = await transactionsApi.list(params);
      return res.data;
    },
  });

  // 2. Initiate Payment Form
  const {
    register,
    handleSubmit,
    reset: resetInitiateForm,
    formState: { errors: initiateErrors, isSubmitting: isInitiating },
  } = useForm<InitiatePaymentFormValues>({
    resolver: zodResolver(initiatePaymentSchema),
    defaultValues: {
      amount: 150.0,
      currency: 'USD',
      gateway: 'STRIPE',
      orderId: 'ord_101',
      returnUrl: 'https://checkout.enterprise.local/callback',
    },
  });

  const initiateMutation = useMutation({
    mutationFn: async (values: InitiatePaymentFormValues) => {
      return transactionsApi.initiate({
        amount: values.amount,
        currency: sanitizeString(values.currency).toUpperCase(),
        gateway: values.gateway,
        orderId: values.orderId ? sanitizeString(values.orderId) : undefined,
        returnUrl: values.returnUrl ? sanitizeString(values.returnUrl) : undefined,
      });
    },
    onSuccess: (res) => {
      toast.success(`Payment initiated! Transaction ID: ${res.data.transactionId}`);
      queryClient.invalidateQueries({ queryKey: ['explorer-transactions'] });
      setIsInitiateModalOpen(false);
      resetInitiateForm();
      setActionError(null);
    },
    onError: (err) => {
      const apiErr = extractApiServiceError(err);
      setActionError(apiErr.message);
      toast.error(`Initiation failed: ${apiErr.message}`);
    },
  });

  // 3. Refund Payment
  const refundMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return transactionsApi.refund(id, { reason: sanitizeString(reason) });
    },
    onSuccess: () => {
      toast.success('Transaction refunded successfully');
      queryClient.invalidateQueries({ queryKey: ['explorer-transactions'] });
      setTxnToRefund(null);
      setRefundReason('');
      setActionError(null);
    },
    onError: (err) => {
      const apiErr = extractApiServiceError(err);
      setActionError(apiErr.message);
      toast.error(`Refund failed: ${apiErr.message}`);
    },
  });

  const getStatusBadgeVariant = (status: TransactionStatus) => {
    switch (status) {
      case 'SUCCEEDED':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'FAILED':
      case 'REFUNDED':
        return 'error';
      default:
        return 'neutral';
    }
  };

  return (
    <div className={styles.tabContainer}>
      {actionError && (
        <Alert variant="error" title="Action Error">
          {actionError}
        </Alert>
      )}

      {queryError && (
        <Alert variant="error" title="Failed to Load Transactions">
          {extractApiServiceError(queryError).message}
        </Alert>
      )}

      {/* Header Controls */}
      <div className={styles.sectionHeader}>
        <div className={styles.searchFilterRow}>
          <select
            value={gatewayFilter}
            onChange={(e) => setGatewayFilter(e.target.value)}
            className={styles.formSelect}
            aria-label="Filter transactions by gateway"
          >
            <option value="all">All Gateways</option>
            <option value="STRIPE">Stripe</option>
            <option value="PAYPAL">PayPal</option>
            <option value="RAZORPAY">Razorpay</option>
            <option value="MOCK">Mock Gateway</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.formSelect}
            aria-label="Filter transactions by status"
          >
            <option value="all">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="SUCCEEDED">Succeeded</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
          </select>

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
            setIsInitiateModalOpen(true);
          }}
        >
          Initiate Payment
        </Button>
      </div>

      {/* Transactions Table */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Spinner size={32} />
        </div>
      ) : transactions.length === 0 ? (
        <div className={styles.emptyState}>
          <CreditCard size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
          <div>No transactions recorded. Click "Initiate Payment" to create a new transaction.</div>
        </div>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Transaction ID</TableHeaderCell>
              <TableHeaderCell>Order ID</TableHeaderCell>
              <TableHeaderCell>Gateway</TableHeaderCell>
              <TableHeaderCell>Amount</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Timestamp</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {transactions.map((txn) => (
              <TableRow key={txn.id}>
                <TableCell>
                  <strong>{txn.id}</strong>
                  {txn.gatewayTransactionId && (
                    <div style={{ fontSize: 11, color: '#64748b' }}>
                      {txn.gatewayTransactionId}
                    </div>
                  )}
                </TableCell>
                <TableCell style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {txn.orderId || '-'}
                </TableCell>
                <TableCell>
                  <Badge variant="neutral">{txn.gateway}</Badge>
                </TableCell>
                <TableCell>
                  <strong>
                    {txn.currency} {Number(txn.amount).toFixed(2)}
                  </strong>
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(txn.status)} withDot>
                    {txn.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {txn.createdAt ? new Date(txn.createdAt).toLocaleDateString() : 'N/A'}
                </TableCell>
                <TableCell>
                  <div className={styles.actionsCell}>
                    <button
                      type="button"
                      className={styles.actionIconBtn}
                      title="View Details"
                      onClick={() => setSelectedTxn(txn)}
                    >
                      <Eye size={13} />
                    </button>
                    {txn.status === 'SUCCEEDED' && (
                      <button
                        type="button"
                        className={`${styles.actionIconBtn} ${styles.deleteIconBtn}`}
                        title="Refund Transaction"
                        onClick={() => setTxnToRefund(txn)}
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Initiate Payment Modal */}
      <Modal
        isOpen={isInitiateModalOpen}
        onClose={() => setIsInitiateModalOpen(false)}
        title="Initiate Gateway Payment"
      >
        <form
          className={styles.modalForm}
          onSubmit={handleSubmit((data) => initiateMutation.mutate(data))}
        >
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Amount *</label>
              <input
                type="number"
                step="0.01"
                className={styles.formInput}
                {...register('amount', { valueAsNumber: true })}
              />
              {initiateErrors.amount && (
                <span className={styles.formError}>{initiateErrors.amount.message}</span>
              )}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Currency *</label>
              <input className={styles.formInput} placeholder="USD" {...register('currency')} />
              {initiateErrors.currency && (
                <span className={styles.formError}>{initiateErrors.currency.message}</span>
              )}
            </div>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Payment Gateway *</label>
              <select className={styles.formSelect} {...register('gateway')}>
                <option value="STRIPE">Stripe</option>
                <option value="PAYPAL">PayPal</option>
                <option value="RAZORPAY">Razorpay</option>
                <option value="MOCK">Mock Gateway</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Order Reference ID</label>
              <input className={styles.formInput} placeholder="ord_101" {...register('orderId')} />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Return / Callback URL (Whitelisted)</label>
            <input
              className={styles.formInput}
              placeholder="https://checkout.enterprise.local/callback"
              {...register('returnUrl')}
            />
            {initiateErrors.returnUrl && (
              <span className={styles.formError}>{initiateErrors.returnUrl.message}</span>
            )}
          </div>

          <div className={styles.modalFooter}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsInitiateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isInitiating}>
              Initiate Payment
            </Button>
          </div>
        </form>
      </Modal>

      {/* Transaction Details Modal */}
      <Modal
        isOpen={Boolean(selectedTxn)}
        onClose={() => setSelectedTxn(null)}
        title={`Transaction Details: ${selectedTxn?.id}`}
      >
        {selectedTxn && (
          <div className={styles.modalForm}>
            <div className={styles.codeBlock}>
              <pre>{JSON.stringify(selectedTxn, null, 2)}</pre>
            </div>
            <div className={styles.modalFooter}>
              <Button variant="outline" onClick={() => setSelectedTxn(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Refund Transaction Modal */}
      <Modal
        isOpen={Boolean(txnToRefund)}
        onClose={() => setTxnToRefund(null)}
        title={`Refund Transaction ${txnToRefund?.id}`}
      >
        {txnToRefund && (
          <div className={styles.modalForm}>
            <p style={{ margin: 0, fontSize: 13, color: '#464555' }}>
              Are you sure you want to refund <strong>{txnToRefund.currency} {Number(txnToRefund.amount).toFixed(2)}</strong> processed via <strong>{txnToRefund.gateway}</strong>?
            </p>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Refund Reason</label>
              <input
                className={styles.formInput}
                placeholder="e.g. Returned merchandise / customer dispute"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
            </div>

            <div className={styles.modalFooter}>
              <Button variant="outline" onClick={() => setTxnToRefund(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                isLoading={refundMutation.isPending}
                onClick={() =>
                  refundMutation.mutate({ id: txnToRefund.id, reason: refundReason })
                }
              >
                Confirm Refund
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
