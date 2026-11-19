import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, FolderArchive, RefreshCw, Trash2, Eye, Download } from 'lucide-react';
import {
  assetsApi,
  AssetDto,
} from '../../../core/api/services/assetsApi';
import { extractApiServiceError } from '../../../core/api/envelope';
import { sanitizeString, isValidUrl } from '../../../utils/sanitize';
import { Button } from '../../../components/ui/Button/Button';
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

// Zod Validation Schema with protocol whitelisting (Requirement R4)
const createAssetSchema = z.object({
  name: z.string().min(1, 'Asset file name is required'),
  mimeType: z.string().min(1, 'MIME type is required'),
  sizeBytes: z.number().int().positive('Size must be positive'),
  url: z
    .string()
    .optional()
    .refine((val) => !val || isValidUrl(val), {
      message: 'URL must use secure http: or https: protocol',
    }),
});

type CreateAssetFormValues = z.infer<typeof createAssetSchema>;

export const AssetsTab: React.FC = () => {
  const queryClient = useQueryClient();

  const [mimeFilter, setMimeFilter] = useState<string>('all');
  const [selectedAsset, setSelectedAsset] = useState<AssetDto | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<AssetDto | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // 1. Fetch Assets
  const {
    data: assets = [],
    isLoading,
    isRefetching,
    refetch,
    error: queryError,
  } = useQuery({
    queryKey: ['explorer-assets', mimeFilter],
    queryFn: async () => {
      const params = mimeFilter !== 'all' ? { mimeType: mimeFilter } : undefined;
      const res = await assetsApi.list(params);
      return res.data;
    },
  });

  // 2. Upload / Register Asset Form
  const {
    register,
    handleSubmit,
    reset: resetUploadForm,
    formState: { errors: uploadErrors, isSubmitting: isUploading },
  } = useForm<CreateAssetFormValues>({
    resolver: zodResolver(createAssetSchema),
    defaultValues: {
      name: '',
      mimeType: 'application/pdf',
      sizeBytes: 1048576,
      url: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: CreateAssetFormValues) => {
      return assetsApi.create({
        name: sanitizeString(values.name),
        mimeType: sanitizeString(values.mimeType),
        sizeBytes: values.sizeBytes,
        url: values.url ? sanitizeString(values.url) : undefined,
      });
    },
    onSuccess: (res) => {
      toast.success(`Asset "${res.data.name}" registered successfully!`);
      queryClient.invalidateQueries({ queryKey: ['explorer-assets'] });
      setIsUploadModalOpen(false);
      resetUploadForm();
      setActionError(null);
    },
    onError: (err) => {
      const apiErr = extractApiServiceError(err);
      setActionError(apiErr.message);
      toast.error(`Upload registration failed: ${apiErr.message}`);
    },
  });

  // 3. Delete Asset
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return assetsApi.delete(id);
    },
    onSuccess: () => {
      toast.success('Asset deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['explorer-assets'] });
      setAssetToDelete(null);
      setActionError(null);
    },
    onError: (err) => {
      const apiErr = extractApiServiceError(err);
      setActionError(apiErr.message);
      toast.error(`Deletion failed: ${apiErr.message}`);
    },
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className={styles.tabContainer}>
      {actionError && (
        <Alert variant="error" title="Action Failed">
          {actionError}
        </Alert>
      )}

      {queryError && (
        <Alert variant="error" title="Failed to Load Assets">
          {extractApiServiceError(queryError).message}
        </Alert>
      )}

      {/* Header Controls */}
      <div className={styles.sectionHeader}>
        <div className={styles.searchFilterRow}>
          <select
            value={mimeFilter}
            onChange={(e) => setMimeFilter(e.target.value)}
            className={styles.formSelect}
            aria-label="Filter assets by MIME type"
          >
            <option value="all">All MIME Types</option>
            <option value="application/pdf">PDF Documents</option>
            <option value="application/dicom">DICOM Medical Scans</option>
            <option value="image/png">PNG Images</option>
            <option value="image/jpeg">JPEG Images</option>
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
            setIsUploadModalOpen(true);
          }}
        >
          Register Asset
        </Button>
      </div>

      {/* Assets Table */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Spinner size={32} />
        </div>
      ) : assets.length === 0 ? (
        <div className={styles.emptyState}>
          <FolderArchive size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
          <div>No media or document assets found. Click "Register Asset" to add new files.</div>
        </div>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>File Name</TableHeaderCell>
              <TableHeaderCell>MIME Type</TableHeaderCell>
              <TableHeaderCell>File Size</TableHeaderCell>
              <TableHeaderCell>Storage Provider</TableHeaderCell>
              <TableHeaderCell>Registered</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {assets.map((asset) => (
              <TableRow key={asset.id}>
                <TableCell>
                  <strong>{asset.name}</strong>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{asset.id}</div>
                </TableCell>
                <TableCell style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {asset.mimeType}
                </TableCell>
                <TableCell>{formatFileSize(asset.sizeBytes)}</TableCell>
                <TableCell>{asset.storageProvider || 'LOCAL'}</TableCell>
                <TableCell>
                  {asset.createdAt ? new Date(asset.createdAt).toLocaleDateString() : 'N/A'}
                </TableCell>
                <TableCell>
                  <div className={styles.actionsCell}>
                    <button
                      type="button"
                      className={styles.actionIconBtn}
                      title="View Details"
                      onClick={() => setSelectedAsset(asset)}
                    >
                      <Eye size={13} />
                    </button>
                    {asset.url && (
                      <a
                        href={asset.url}
                        target="_blank"
                        rel="noreferrer"
                        className={styles.actionIconBtn}
                        title="Download Asset"
                      >
                        <Download size={13} />
                      </a>
                    )}
                    <button
                      type="button"
                      className={`${styles.actionIconBtn} ${styles.deleteIconBtn}`}
                      title="Delete Asset"
                      onClick={() => setAssetToDelete(asset)}
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

      {/* Upload Asset Modal */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        title="Register File Asset Metadata"
      >
        <form
          className={styles.modalForm}
          onSubmit={handleSubmit((data) => createMutation.mutate(data))}
        >
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>File Name *</label>
            <input
              className={styles.formInput}
              placeholder="e.g. quarterly_report_2026.pdf"
              {...register('name')}
            />
            {uploadErrors.name && (
              <span className={styles.formError}>{uploadErrors.name.message}</span>
            )}
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>MIME Type *</label>
              <select className={styles.formSelect} {...register('mimeType')}>
                <option value="application/pdf">application/pdf</option>
                <option value="application/dicom">application/dicom</option>
                <option value="image/png">image/png</option>
                <option value="image/jpeg">image/jpeg</option>
                <option value="text/plain">text/plain</option>
              </select>
              {uploadErrors.mimeType && (
                <span className={styles.formError}>{uploadErrors.mimeType.message}</span>
              )}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Size in Bytes *</label>
              <input
                type="number"
                className={styles.formInput}
                {...register('sizeBytes', { valueAsNumber: true })}
              />
              {uploadErrors.sizeBytes && (
                <span className={styles.formError}>{uploadErrors.sizeBytes.message}</span>
              )}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Download / CDN URL (Optional, Whitelisted)</label>
            <input
              className={styles.formInput}
              placeholder="https://storage.cdn.enterprise.local/assets/file.pdf"
              {...register('url')}
            />
            {uploadErrors.url && (
              <span className={styles.formError}>{uploadErrors.url.message}</span>
            )}
          </div>

          <div className={styles.modalFooter}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsUploadModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isUploading}>
              Register Asset
            </Button>
          </div>
        </form>
      </Modal>

      {/* Asset Details Modal */}
      <Modal
        isOpen={Boolean(selectedAsset)}
        onClose={() => setSelectedAsset(null)}
        title={`Asset Details: ${selectedAsset?.name}`}
      >
        {selectedAsset && (
          <div className={styles.modalForm}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <span className={styles.formLabel}>Storage Key</span>
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                  {selectedAsset.key || selectedAsset.id}
                </span>
              </div>
              <div className={styles.formGroup}>
                <span className={styles.formLabel}>Formatted Size</span>
                <span>{formatFileSize(selectedAsset.sizeBytes)}</span>
              </div>
            </div>

            {selectedAsset.url && (
              <div className={styles.formGroup}>
                <span className={styles.formLabel}>Direct URL</span>
                <a
                  href={selectedAsset.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: 'var(--color-primary, #3525cd)', fontSize: 13, wordBreak: 'break-all' }}
                >
                  {selectedAsset.url}
                </a>
              </div>
            )}

            <div className={styles.codeBlock}>
              <pre>{JSON.stringify(selectedAsset, null, 2)}</pre>
            </div>

            <div className={styles.modalFooter}>
              <Button variant="outline" onClick={() => setSelectedAsset(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(assetToDelete)}
        onClose={() => setAssetToDelete(null)}
        title="Confirm Asset Deletion"
      >
        {assetToDelete && (
          <div className={styles.modalForm}>
            <p style={{ margin: 0, fontSize: 13, color: '#464555' }}>
              Are you sure you want to permanently delete <strong>{assetToDelete.name}</strong> ({assetToDelete.id})? This action cannot be undone.
            </p>
            <div className={styles.modalFooter}>
              <Button variant="outline" onClick={() => setAssetToDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                isLoading={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(assetToDelete.id)}
              >
                Delete Asset
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
