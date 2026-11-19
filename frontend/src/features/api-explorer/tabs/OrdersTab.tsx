import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Eye, XCircle, RefreshCw, ShoppingCart, Trash2 } from 'lucide-react';
import {
  ordersApi,
  OrderDto,
  OrderStatus,
} from '../../../core/api/services/ordersApi';
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

// Zod Validation Schemas (Requirement R4)
const orderItemSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  name: z.string().optional(),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  unitPrice: z.number().positive('Unit price must be positive'),
});

const createOrderSchema = z.object({
  currency: z.string().min(3).max(3).default('USD'),
  items: z.array(orderItemSchema).min(1, 'At least one line item is required'),
});

type CreateOrderFormValues = z.infer<typeof createOrderSchema>;

const cancelOrderSchema = z.object({
  reason: z.string().min(3, 'Cancellation reason is required (min 3 chars)'),
});

type CancelOrderFormValues = z.infer<typeof cancelOrderSchema>;

export const OrdersTab: React.FC = () => {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<OrderDto | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<OrderDto | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // 1. Fetch Orders
  const {
    data: orders = [],
    isLoading,
    isRefetching,
    refetch,
    error: queryError,
  } = useQuery({
    queryKey: ['explorer-orders', statusFilter],
    queryFn: async () => {
      const params = statusFilter !== 'all' ? { status: statusFilter as OrderStatus } : undefined;
      const res = await ordersApi.listOrders(params);
      return res.data;
    },
  });

  // 2. Create Order Form
  const {
    register,
    control,
    handleSubmit,
    reset: resetCreateForm,
    formState: { errors: createErrors, isSubmitting: isCreating },
  } = useForm<CreateOrderFormValues>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      currency: 'USD',
      items: [{ productId: 'prod_mri_1', name: 'Contrast Diagnostic Kit', quantity: 1, unitPrice: 450.0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  const createMutation = useMutation({
    mutationFn: async (values: CreateOrderFormValues) => {
      const payload = {
        currency: sanitizeString(values.currency).toUpperCase(),
        items: values.items.map((item) => ({
          productId: sanitizeString(item.productId),
          name: sanitizeString(item.name),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      };
      return ordersApi.create(payload);
    },
    onSuccess: (res) => {
      toast.success(`Order #${res.data.orderNumber || res.data.id} created successfully!`);
      queryClient.invalidateQueries({ queryKey: ['explorer-orders'] });
      setIsCreateModalOpen(false);
      resetCreateForm();
      setActionError(null);
    },
    onError: (err) => {
      const apiErr = extractApiServiceError(err);
      setActionError(apiErr.message);
      toast.error(`Order creation failed: ${apiErr.message}`);
    },
  });

  // 3. Cancel Order Form
  const {
    register: registerCancel,
    handleSubmit: handleCancelSubmit,
    reset: resetCancelForm,
    formState: { errors: cancelErrors, isSubmitting: isCancelling },
  } = useForm<CancelOrderFormValues>({
    resolver: zodResolver(cancelOrderSchema),
    defaultValues: { reason: '' },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return ordersApi.cancel(id, sanitizeString(reason));
    },
    onSuccess: (res) => {
      toast.success(`Order #${res.data.orderNumber || res.data.id} cancelled.`);
      queryClient.invalidateQueries({ queryKey: ['explorer-orders'] });
      setIsCancelModalOpen(false);
      setOrderToCancel(null);
      resetCancelForm();
      setActionError(null);
    },
    onError: (err) => {
      const apiErr = extractApiServiceError(err);
      setActionError(apiErr.message);
      toast.error(`Order cancellation failed: ${apiErr.message}`);
    },
  });

  const filteredOrders = orders.filter((o) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (o.orderNumber && o.orderNumber.toLowerCase().includes(q)) ||
      o.id.toLowerCase().includes(q) ||
      (o.userId && o.userId.toLowerCase().includes(q))
    );
  });

  const getStatusBadgeVariant = (status: OrderStatus) => {
    switch (status) {
      case 'CONFIRMED':
      case 'DELIVERED':
        return 'success';
      case 'PROCESSING':
      case 'SHIPPED':
        return 'primary';
      case 'PENDING':
        return 'warning';
      case 'CANCELLED':
        return 'error';
      default:
        return 'neutral';
    }
  };

  return (
    <div className={styles.tabContainer}>
      {actionError && (
        <Alert variant="error" title="Action Failed">
          {actionError}
        </Alert>
      )}

      {queryError && (
        <Alert variant="error" title="Failed to Load Orders">
          {extractApiServiceError(queryError).message}
        </Alert>
      )}

      {/* Header & Controls */}
      <div className={styles.sectionHeader}>
        <div className={styles.searchFilterRow}>
          <Input
            placeholder="Search by Order # or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 280 }}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.formSelect}
            aria-label="Filter orders by status"
          >
            <option value="all">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="PROCESSING">Processing</option>
            <option value="SHIPPED">Shipped</option>
            <option value="DELIVERED">Delivered</option>
            <option value="CANCELLED">Cancelled</option>
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
            setIsCreateModalOpen(true);
          }}
        >
          Create Order
        </Button>
      </div>

      {/* Orders Table */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Spinner size={32} />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className={styles.emptyState}>
          <ShoppingCart size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
          <div>No orders found. Click "Create Order" to submit a new transaction.</div>
        </div>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Order #</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Items</TableHeaderCell>
              <TableHeaderCell>Total Amount</TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredOrders.map((order) => (
              <TableRow key={order.id}>
                <TableCell>
                  <strong>{order.orderNumber || order.id}</strong>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{order.id}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(order.status)} withDot>
                    {order.status}
                  </Badge>
                </TableCell>
                <TableCell>{order.items?.length || 0} line item(s)</TableCell>
                <TableCell>
                  <strong>
                    {order.currency || 'USD'} {Number(order.totalAmount || 0).toFixed(2)}
                  </strong>
                </TableCell>
                <TableCell>
                  {order.createdAt ? new Date(order.createdAt).toLocaleDateString() : 'N/A'}
                </TableCell>
                <TableCell>
                  <div className={styles.actionsCell}>
                    <button
                      type="button"
                      className={styles.actionIconBtn}
                      title="View Details"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <Eye size={13} />
                    </button>
                    {order.status !== 'CANCELLED' && (
                      <button
                        type="button"
                        className={`${styles.actionIconBtn} ${styles.deleteIconBtn}`}
                        title="Cancel Order"
                        onClick={() => {
                          setOrderToCancel(order);
                          setIsCancelModalOpen(true);
                        }}
                      >
                        <XCircle size={13} />
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Create Order Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Order"
      >
        <form
          className={styles.modalForm}
          onSubmit={handleSubmit((data) => createMutation.mutate(data))}
        >
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Currency</label>
            <input
              className={styles.formInput}
              placeholder="USD"
              {...register('currency')}
            />
            {createErrors.currency && (
              <span className={styles.formError}>{createErrors.currency.message}</span>
            )}
          </div>

          <div className={styles.formGroup}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className={styles.formLabel}>Line Items</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ productId: '', name: '', quantity: 1, unitPrice: 10.0 })}
              >
                + Add Item
              </Button>
            </div>

            <div className={styles.lineItemsList} style={{ marginTop: 8 }}>
              {fields.map((field, idx) => (
                <div key={field.id} className={styles.lineItemRow}>
                  <input
                    className={styles.formInput}
                    placeholder="Product ID (e.g. prod_mri_1)"
                    style={{ flex: 2 }}
                    {...register(`items.${idx}.productId` as const)}
                  />
                  <input
                    className={styles.formInput}
                    placeholder="Item Name"
                    style={{ flex: 2 }}
                    {...register(`items.${idx}.name` as const)}
                  />
                  <input
                    className={styles.formInput}
                    type="number"
                    placeholder="Qty"
                    style={{ width: 70 }}
                    {...register(`items.${idx}.quantity` as const, { valueAsNumber: true })}
                  />
                  <input
                    className={styles.formInput}
                    type="number"
                    step="0.01"
                    placeholder="Price"
                    style={{ width: 90 }}
                    {...register(`items.${idx}.unitPrice` as const, { valueAsNumber: true })}
                  />
                  {fields.length > 1 && (
                    <button
                      type="button"
                      className={`${styles.actionIconBtn} ${styles.deleteIconBtn}`}
                      onClick={() => remove(idx)}
                      title="Remove Item"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {createErrors.items && (
              <span className={styles.formError}>{createErrors.items.message}</span>
            )}
          </div>

          <div className={styles.modalFooter}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isCreating}>
              Create Order
            </Button>
          </div>
        </form>
      </Modal>

      {/* View Order Details Modal */}
      <Modal
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        title={`Order Details: ${selectedOrder?.orderNumber || selectedOrder?.id}`}
      >
        {selectedOrder && (
          <div className={styles.modalForm}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <span className={styles.formLabel}>Order Status</span>
                <div>
                  <Badge variant={getStatusBadgeVariant(selectedOrder.status)} withDot>
                    {selectedOrder.status}
                  </Badge>
                </div>
              </div>
              <div className={styles.formGroup}>
                <span className={styles.formLabel}>Total Amount</span>
                <strong>
                  {selectedOrder.currency} {Number(selectedOrder.totalAmount).toFixed(2)}
                </strong>
              </div>
            </div>

            <div className={styles.formGroup}>
              <span className={styles.formLabel}>Line Items</span>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Product ID</TableHeaderCell>
                    <TableHeaderCell>Name</TableHeaderCell>
                    <TableHeaderCell>Qty</TableHeaderCell>
                    <TableHeaderCell>Unit Price</TableHeaderCell>
                    <TableHeaderCell>Total</TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedOrder.items?.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.productId}</TableCell>
                      <TableCell>{item.name || '-'}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>${Number(item.unitPrice).toFixed(2)}</TableCell>
                      <TableCell>${Number(item.totalPrice).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className={styles.codeBlock}>
              <pre>{JSON.stringify(selectedOrder, null, 2)}</pre>
            </div>

            <div className={styles.modalFooter}>
              <Button variant="outline" onClick={() => setSelectedOrder(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancel Order Action Modal */}
      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => {
          setIsCancelModalOpen(false);
          setOrderToCancel(null);
        }}
        title={`Cancel Order #${orderToCancel?.orderNumber || orderToCancel?.id}`}
      >
        <form
          className={styles.modalForm}
          onSubmit={handleCancelSubmit((data) => {
            if (orderToCancel) {
              cancelMutation.mutate({ id: orderToCancel.id, reason: data.reason });
            }
          })}
        >
          <p style={{ margin: 0, fontSize: 13, color: '#464555' }}>
            Are you sure you want to cancel this order? This action will reverse reservations and update status to CANCELLED.
          </p>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Reason for Cancellation</label>
            <input
              className={styles.formInput}
              placeholder="e.g. Customer requested cancellation / Stock shortfall"
              {...registerCancel('reason')}
            />
            {cancelErrors.reason && (
              <span className={styles.formError}>{cancelErrors.reason.message}</span>
            )}
          </div>

          <div className={styles.modalFooter}>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsCancelModalOpen(false);
                setOrderToCancel(null);
              }}
            >
              Back
            </Button>
            <Button type="submit" variant="danger" isLoading={isCancelling}>
              Confirm Cancellation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
