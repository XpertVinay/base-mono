import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, Key, QrCode, RefreshCw, Copy, Check, Lock } from 'lucide-react';
import {
  iamApi,
  MfaSetupResponseDto,
} from '../../../core/api/services/iamApi';
import { extractApiServiceError } from '../../../core/api/envelope';
import { sanitizeString } from '../../../utils/sanitize';
import { Button } from '../../../components/ui/Button/Button';
import { Badge } from '../../../components/ui/Badge/Badge';
import { Spinner } from '../../../components/ui/Spinner/Spinner';
import { Modal } from '../../../components/ui/Modal/Modal';
import { Alert } from '../../../components/ui/Alert/Alert';
import { toast } from '../../../components/ui/Toast';
import styles from './Tabs.module.css';

// 6-digit TOTP code validation schema
const verifyTotpSchema = z.object({
  code: z
    .string()
    .min(6, 'TOTP code must be 6 digits')
    .max(6, 'TOTP code must be 6 digits')
    .regex(/^[0-9]{6}$/, 'Must be numeric 6 digits'),
});

type VerifyTotpFormValues = z.infer<typeof verifyTotpSchema>;

export const MfaCryptoTab: React.FC = () => {
  const queryClient = useQueryClient();

  const [setupData, setSetupData] = useState<MfaSetupResponseDto | null>(null);
  const [isSetupWizardOpen, setIsSetupWizardOpen] = useState(false);
  const [isReverifyModalOpen, setIsReverifyModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // 1. Fetch MFA Status
  const {
    data: mfaStatus,
    isLoading: isStatusLoading,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['explorer-iam-mfa-status'],
    queryFn: async () => {
      const res = await iamApi.getMfaStatus();
      return res.data;
    },
  });

  // 2. Fetch JWKS
  const {
    data: jwksData,
    isLoading: isJwksLoading,
    refetch: refetchJwks,
  } = useQuery({
    queryKey: ['explorer-iam-jwks'],
    queryFn: async () => {
      const res = await iamApi.getJwks();
      return res.data;
    },
  });

  // 3. Fetch RSA Public Key
  const {
    data: publicKeyData,
    isLoading: isPubkeyLoading,
    refetch: refetchPublicKey,
  } = useQuery({
    queryKey: ['explorer-iam-public-key'],
    queryFn: async () => {
      const res = await iamApi.getPublicKey();
      return res.data;
    },
  });

  // 4. Setup MFA Initiation Mutation
  const setupMfaMutation = useMutation({
    mutationFn: async () => {
      return iamApi.setupMfa();
    },
    onSuccess: (res) => {
      setSetupData(res.data);
      setIsSetupWizardOpen(true);
      setActionError(null);
    },
    onError: (err) => {
      const apiErr = extractApiServiceError(err);
      setActionError(apiErr.message);
      toast.error(`MFA Setup initialization failed: ${apiErr.message}`);
    },
  });

  // 5. Enable MFA Form
  const {
    register: registerEnable,
    handleSubmit: handleEnableSubmit,
    reset: resetEnableForm,
    formState: { errors: enableErrors, isSubmitting: isEnabling },
  } = useForm<VerifyTotpFormValues>({
    resolver: zodResolver(verifyTotpSchema),
    defaultValues: { code: '' },
  });

  const enableMfaMutation = useMutation({
    mutationFn: async (values: VerifyTotpFormValues) => {
      if (!setupData?.secret) throw new Error('Missing MFA setup secret');
      return iamApi.enableMfa({
        code: sanitizeString(values.code),
        secret: setupData.secret,
      });
    },
    onSuccess: () => {
      toast.success('MFA activated successfully on your account!');
      queryClient.invalidateQueries({ queryKey: ['explorer-iam-mfa-status'] });
      setIsSetupWizardOpen(false);
      setSetupData(null);
      resetEnableForm();
      setActionError(null);
    },
    onError: (err) => {
      const apiErr = extractApiServiceError(err);
      setActionError(apiErr.message);
      toast.error(`MFA activation failed: ${apiErr.message}`);
    },
  });

  // 6. Re-verify MFA Form
  const {
    register: registerReverify,
    handleSubmit: handleReverifySubmit,
    reset: resetReverifyForm,
    formState: { errors: reverifyErrors, isSubmitting: isReverifying },
  } = useForm<VerifyTotpFormValues>({
    resolver: zodResolver(verifyTotpSchema),
    defaultValues: { code: '' },
  });

  const reverifyMfaMutation = useMutation({
    mutationFn: async (values: VerifyTotpFormValues) => {
      return iamApi.reverifyMfa({ code: sanitizeString(values.code) });
    },
    onSuccess: () => {
      toast.success('MFA session reverified! Window extended for 24 hours.');
      queryClient.invalidateQueries({ queryKey: ['explorer-iam-mfa-status'] });
      setIsReverifyModalOpen(false);
      resetReverifyForm();
      setActionError(null);
    },
    onError: (err) => {
      const apiErr = extractApiServiceError(err);
      setActionError(apiErr.message);
      toast.error(`MFA reverification failed: ${apiErr.message}`);
    },
  });

  const copyPublicKey = () => {
    if (publicKeyData?.publicKey) {
      navigator.clipboard.writeText(publicKeyData.publicKey);
      setCopiedKey(true);
      toast.info('RSA Public Key copied to clipboard');
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  return (
    <div className={styles.tabContainer}>
      {actionError && (
        <Alert variant="error" title="MFA Action Failed">
          {actionError}
        </Alert>
      )}

      {/* MFA Telemetry & Control Cards */}
      <div className={styles.cardsGrid}>
        {/* Card 1: MFA Enrollment & Live Status */}
        <div className={styles.cardItem}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <Shield size={16} /> Two-Factor Authentication (TOTP)
            </div>
            {isStatusLoading ? (
              <Spinner size={16} />
            ) : (
              <Badge variant={mfaStatus?.mfaEnabled ? 'success' : 'warning'} withDot>
                {mfaStatus?.mfaEnabled ? 'Enrolled & Active' : 'Not Enrolled'}
              </Badge>
            )}
          </div>

          <div className={styles.cardMeta}>
            <div>
              <strong>Enforcement Mode:</strong> RFC 6238 Standard TOTP (Google / Microsoft Authenticator)
            </div>
            <div>
              <strong>Session Verified:</strong>{' '}
              {mfaStatus?.isMfaVerifiedSession ? 'Valid 24h Window' : 'Unverified'}
            </div>
            {mfaStatus?.verifiedAt && (
              <div>
                <strong>Last Verified:</strong> {new Date(mfaStatus.verifiedAt).toLocaleString()}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 8 }}>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<QrCode size={14} />}
              isLoading={setupMfaMutation.isPending}
              onClick={() => setupMfaMutation.mutate()}
            >
              {mfaStatus?.mfaEnabled ? 'Reconfigure MFA' : 'Setup MFA Wizard'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              leftIcon={<Lock size={14} />}
              onClick={() => {
                setActionError(null);
                setIsReverifyModalOpen(true);
              }}
            >
              Re-Verify Session
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchStatus()}
              title="Refresh MFA Status"
            >
              <RefreshCw size={13} />
            </Button>
          </div>
        </div>

        {/* Card 2: OpenID Connect JWKS Keys */}
        <div className={styles.cardItem}>
          <div className={styles.cardHeader}>
            <div className={styles.cardTitle}>
              <Key size={16} /> RFC 7517 JWKS Discovery
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetchJwks()}
              title="Refresh JWKS"
            >
              <RefreshCw size={13} />
            </Button>
          </div>

          <div className={styles.cardMeta}>
            <div>
              <strong>Endpoint:</strong> <code>GET /api/iam/.well-known/jwks.json</code>
            </div>
            <div>
              <strong>Algorithm:</strong> RS256 &bull; Asymmetric Token Signature Validation
            </div>
          </div>

          {isJwksLoading ? (
            <Spinner size={20} />
          ) : (
            <div className={styles.codeBlock} style={{ maxHeight: 150 }}>
              <pre>{JSON.stringify(jwksData || {}, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>

      {/* Card 3: Cryptographic RSA Public Key Viewer */}
      <div className={styles.cardItem}>
        <div className={styles.cardHeader}>
          <div className={styles.cardTitle}>
            <Lock size={16} /> SPKI PEM RSA Public Key (<code>GET /api/iam/public-key</code>)
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="outline"
              size="sm"
              leftIcon={copiedKey ? <Check size={13} /> : <Copy size={13} />}
              onClick={copyPublicKey}
            >
              {copiedKey ? 'Copied!' : 'Copy Key'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => refetchPublicKey()}>
              <RefreshCw size={13} />
            </Button>
          </div>
        </div>

        {isPubkeyLoading ? (
          <Spinner size={20} />
        ) : (
          <div className={styles.codeBlock} style={{ maxHeight: 200 }}>
            <pre>{publicKeyData?.publicKey || 'No public key returned'}</pre>
          </div>
        )}
      </div>

      {/* Interactive MFA Setup Wizard Modal */}
      <Modal
        isOpen={isSetupWizardOpen}
        onClose={() => {
          setIsSetupWizardOpen(false);
          setSetupData(null);
        }}
        title="MFA TOTP Enrollment Wizard"
      >
        {setupData && (
          <form
            className={styles.modalForm}
            onSubmit={handleEnableSubmit((data) => enableMfaMutation.mutate(data))}
          >
            <Alert variant="info" title="Scan QR Code or Enter Secret">
              Scan the QR code in your authenticator app, or manually copy the secret key below.
            </Alert>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 8 }}>
              {setupData.qrCode ? (
                <div
                  dangerouslySetInnerHTML={{ __html: setupData.qrCode }}
                  style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 8, background: '#fff' }}
                />
              ) : (
                <div style={{ border: '1px solid #e2e8f0', padding: 24, borderRadius: 8 }}>
                  <QrCode size={96} />
                </div>
              )}

              <div style={{ textAlign: 'center' }}>
                <span className={styles.formLabel}>Shared Base32 Secret:</span>
                <div
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: 2,
                    background: '#eff4ff',
                    padding: '6px 12px',
                    borderRadius: 6,
                    marginTop: 4,
                  }}
                >
                  {setupData.secret}
                </div>
              </div>
            </div>

            {setupData.recoveryCodes && setupData.recoveryCodes.length > 0 && (
              <div className={styles.formGroup}>
                <span className={styles.formLabel}>Emergency Recovery Codes (Save these safely):</span>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 6,
                    background: '#f8fafc',
                    padding: 8,
                    borderRadius: 6,
                    fontFamily: 'monospace',
                    fontSize: 12,
                  }}
                >
                  {setupData.recoveryCodes.map((code, idx) => (
                    <div key={idx}>&bull; {code}</div>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Enter 6-Digit Code from Authenticator App *</label>
              <input
                className={styles.formInput}
                placeholder="123456"
                maxLength={6}
                style={{ fontSize: 18, letterSpacing: 4, textAlign: 'center' }}
                {...registerEnable('code')}
              />
              {enableErrors.code && (
                <span className={styles.formError}>{enableErrors.code.message}</span>
              )}
            </div>

            <div className={styles.modalFooter}>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsSetupWizardOpen(false);
                  setSetupData(null);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isEnabling}>
                Verify &amp; Activate MFA
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Re-verify MFA Modal */}
      <Modal
        isOpen={isReverifyModalOpen}
        onClose={() => setIsReverifyModalOpen(false)}
        title="Re-verify Authenticated MFA Session"
      >
        <form
          className={styles.modalForm}
          onSubmit={handleReverifySubmit((data) => reverifyMfaMutation.mutate(data))}
        >
          <p style={{ margin: 0, fontSize: 13, color: '#464555' }}>
            Elevate or renew your administrative session window by submitting your current 6-digit TOTP token.
          </p>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>6-Digit TOTP Code</label>
            <input
              className={styles.formInput}
              placeholder="123456"
              maxLength={6}
              style={{ fontSize: 18, letterSpacing: 4, textAlign: 'center' }}
              {...registerReverify('code')}
            />
            {reverifyErrors.code && (
              <span className={styles.formError}>{reverifyErrors.code.message}</span>
            )}
          </div>

          <div className={styles.modalFooter}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsReverifyModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isReverifying}>
              Confirm Re-verification
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
