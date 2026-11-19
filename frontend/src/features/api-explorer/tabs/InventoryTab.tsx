import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Boxes, RefreshCw, BookmarkCheck, Search } from 'lucide-react';
import {
  inventoryApi,
  InventoryItemDto,
} from '../../../core/api/services/inventoryApi';
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

// Zod Validation Schemas
const addStockSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  sku: z.string().min(1, 'SKU identifier is required'),
  name: z.string().optional(),
  quantity: z.number().int().positive('Quantity to add must be at least 1'),
  warehouseId: z.string().optional(),
});

type AddStockFormValues = z.infer<typeof addStockSchema>;

const reserveStockSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().positive('Reservation quantity must be at least 1'),
  orderId: z.string().optional(),
  reservationTtlMinutes: z.number().int().min(1).default(15),
});

type ReserveStockFormValues = z.infer<typeof reserveStockSchema>;

export const InventoryTab: React.FC = () => {
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [lookupProductId, setLookupProductId] = useState('');
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [isReserveStockOpen, setIsReserveStockOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItemDto | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // 1. Fetch Inventory Catalog
  const {
    data: items = [],
    isLoading,
    isRefetching,
    refetch,
    error: queryError,
  } = useQuery({
    queryKey: ['explorer-inventory'],
    queryFn: async () => {
      const res = await inventoryApi.listItems();
      return res.data;
    },
  });

  // 2. Add Stock Form
  const {
    register: registerAdd,
    handleSubmit: handleAddSubmit,
    reset: resetAddForm,
    formState: { errors: addErrors, isSubmitting: isAdding },
  } = useForm<AddStockFormValues>({
    resolver: zodResolver(addStockSchema),
    defaultValues: {
      productId: '',
      sku: '',
      name: '',
      quantity: 50,
      warehouseId: 'wh_main_01',
    },
  });

  const addStockMutation = useMutation({
    mutationFn: async (values: AddStockFormValues) => {
      return inventoryApi.addStock({
        productId: sanitizeString(values.productId),
        sku: sanitizeString(values.sku),
        name: sanitizeString(values.name),
        quantity: values.quantity,
        warehouseId: sanitizeString(values.warehouseId),
      });
    },
    onSuccess: (res) => {
      toast.success(`Added ${res.data.quantity} units to ${res.data.sku}!`);
      queryClient.invalidateQueries({ queryKey: ['explorer-inventory'] });
      setIsAddStockOpen(false);
      resetAddForm();
      setActionError(null);
    },
    onError: (err) => {
      const apiErr = extractApiServiceError(err);
      setActionError(apiErr.message);
      toast.error(`Stock update failed: ${apiErr.message}`);
    },
  });

  // 3. Reserve Stock Form
  const {
    register: registerReserve,
    handleSubmit: handleReserveSubmit,
    setValue: setReserveValue,
    reset: resetReserveForm,
    formState: { errors: reserveErrors, isSubmitting: isReserving },
  } = useForm<ReserveStockFormValues>({
    resolver: zodResolver(reserveStockSchema),
    defaultValues: {
      productId: '',
      quantity: 1,
      orderId: '',
      reservationTtlMinutes: 15,
    },
  });

  const reserveStockMutation = useMutation({
    mutationFn: async (values: ReserveStockFormValues) => {
      return inventoryApi.reserveStock({
        productId: sanitizeString(values.productId),
        quantity: values.quantity,
        orderId: sanitizeString(values.orderId),
        reservationTtlMinutes: values.reservationTtlMinutes,
      });
    },
    onSuccess: () => {
      toast.success(`Stock successfully reserved!`);
      queryClient.invalidateQueries({ queryKey: ['explorer-inventory'] });
      setIsReserveStockOpen(false);
      resetReserveForm();
      setActionError(null);
    },
    onError: (err) => {
      const apiErr = extractApiServiceError(err);
      setActionError(apiErr.message);
      toast.error(`Reservation failed: ${apiErr.message}`);
    },
  });

  // Lookup Specific Product
  const handleProductLookup = async () => {
    if (!lookupProductId.trim()) return;
    try {
      const res = await inventoryApi.getStock(sanitizeString(lookupProductId));
      setSelectedItem(res.data);
      toast.info(`Stock found for ${res.data.productId}: ${res.data.availableQuantity} available`);
    } catch (err) {
      const apiErr = extractApiServiceError(err);
      toast.error(`Product not found: ${apiErr.message}`);
    }
  };

  const filteredItems = items.filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      item.sku.toLowerCase().includes(q) ||
      item.productId.toLowerCase().includes(q) ||
      (item.name && item.name.toLowerCase().includes(q))
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
        <Alert variant="error" title="Failed to Load Inventory">
          {extractApiServiceError(queryError).message}
        </Alert>
      )}

      {/* Header Controls */}
      <div className={styles.sectionHeader}>
        <div className={styles.searchFilterRow}>
          <Input
            placeholder="Search SKU or Product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 260 }}
          />

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Input
              placeholder="Lookup Product ID..."
              value={lookupProductId}
              onChange={(e) => setLookupProductId(e.target.value)}
              style={{ maxWidth: 200 }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleProductLookup}
              leftIcon={<Search size={13} />}
            >
              Lookup
            </Button>
          </div>

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

        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            variant="outline"
            size="sm"
            leftIcon={<BookmarkCheck size={14} />}
            onClick={() => {
              setActionError(null);
              setIsReserveStockOpen(true);
            }}
          >
            Reserve Stock
          </Button>

          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() => {
              setActionError(null);
              setIsAddStockOpen(true);
            }}
          >
            Add Stock
          </Button>
        </div>
      </div>

      {/* Inventory Table */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Spinner size={32} />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className={styles.emptyState}>
          <Boxes size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
          <div>No inventory items recorded. Click "Add Stock" to register new SKUs.</div>
        </div>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>SKU / Identifier</TableHeaderCell>
              <TableHeaderCell>Product ID</TableHeaderCell>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Total Stock</TableHeaderCell>
              <TableHeaderCell>Available</TableHeaderCell>
              <TableHeaderCell>Reserved</TableHeaderCell>
              <TableHeaderCell>Warehouse</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredItems.map((item) => (
              <TableRow key={item.productId}>
                <TableCell>
                  <strong>{item.sku}</strong>
                </TableCell>
                <TableCell style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {item.productId}
                </TableCell>
                <TableCell>{item.name || '-'}</TableCell>
                <TableCell>
                  <strong>{item.quantity}</strong>
                </TableCell>
                <TableCell>
                  <Badge variant={item.availableQuantity > 10 ? 'success' : 'warning'}>
                    {item.availableQuantity} in stock
                  </Badge>
                </TableCell>
                <TableCell>
                  <span style={{ color: item.reservedQuantity > 0 ? '#f59e0b' : '#64748b' }}>
                    {item.reservedQuantity} reserved
                  </span>
                </TableCell>
                <TableCell>{item.warehouseId || 'wh_default'}</TableCell>
                <TableCell>
                  <div className={styles.actionsCell}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setReserveValue('productId', item.productId);
                        setIsReserveStockOpen(true);
                      }}
                    >
                      Reserve
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Add Stock Modal */}
      <Modal
        isOpen={isAddStockOpen}
        onClose={() => setIsAddStockOpen(false)}
        title="Add Inventory Stock"
      >
        <form
          className={styles.modalForm}
          onSubmit={handleAddSubmit((data) => addStockMutation.mutate(data))}
        >
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Product ID *</label>
              <input
                className={styles.formInput}
                placeholder="e.g. prod_mri_1"
                {...registerAdd('productId')}
              />
              {addErrors.productId && (
                <span className={styles.formError}>{addErrors.productId.message}</span>
              )}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>SKU *</label>
              <input
                className={styles.formInput}
                placeholder="e.g. MED-MRI-01"
                {...registerAdd('sku')}
              />
              {addErrors.sku && (
                <span className={styles.formError}>{addErrors.sku.message}</span>
              )}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Item Description / Name</label>
            <input
              className={styles.formInput}
              placeholder="e.g. Contrast Diagnostic MRI Kit"
              {...registerAdd('name')}
            />
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Quantity to Add *</label>
              <input
                type="number"
                className={styles.formInput}
                {...registerAdd('quantity', { valueAsNumber: true })}
              />
              {addErrors.quantity && (
                <span className={styles.formError}>{addErrors.quantity.message}</span>
              )}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Warehouse ID</label>
              <input
                className={styles.formInput}
                placeholder="wh_main_01"
                {...registerAdd('warehouseId')}
              />
            </div>
          </div>

          <div className={styles.modalFooter}>
            <Button type="button" variant="outline" onClick={() => setIsAddStockOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isAdding}>
              Save Stock
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reserve Stock Modal */}
      <Modal
        isOpen={isReserveStockOpen}
        onClose={() => setIsReserveStockOpen(false)}
        title="Reserve Inventory Stock"
      >
        <form
          className={styles.modalForm}
          onSubmit={handleReserveSubmit((data) => reserveStockMutation.mutate(data))}
        >
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Product ID *</label>
            <input
              className={styles.formInput}
              placeholder="e.g. prod_mri_1"
              {...registerReserve('productId')}
            />
            {reserveErrors.productId && (
              <span className={styles.formError}>{reserveErrors.productId.message}</span>
            )}
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Quantity to Reserve *</label>
              <input
                type="number"
                className={styles.formInput}
                {...registerReserve('quantity', { valueAsNumber: true })}
              />
              {reserveErrors.quantity && (
                <span className={styles.formError}>{reserveErrors.quantity.message}</span>
              )}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>TTL (Minutes)</label>
              <input
                type="number"
                className={styles.formInput}
                {...registerReserve('reservationTtlMinutes', { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Order ID (Optional)</label>
            <input
              className={styles.formInput}
              placeholder="e.g. ord_101"
              {...registerReserve('orderId')}
            />
          </div>

          <div className={styles.modalFooter}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsReserveStockOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isReserving}>
              Reserve Units
            </Button>
          </div>
        </form>
      </Modal>

      {/* Lookup Details Modal */}
      <Modal
        isOpen={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        title={`Stock Details: ${selectedItem?.sku || selectedItem?.productId}`}
      >
        {selectedItem && (
          <div className={styles.modalForm}>
            <div className={styles.codeBlock}>
              <pre>{JSON.stringify(selectedItem, null, 2)}</pre>
            </div>
            <div className={styles.modalFooter}>
              <Button variant="outline" onClick={() => setSelectedItem(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
