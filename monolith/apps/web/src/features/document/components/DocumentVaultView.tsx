import React, { useState, useEffect } from 'react';
import {
  FileText,
  ShieldCheck,
  Clock,
  AlertTriangle,
  Upload,
  Download,
  Check,
  X,
  RefreshCw
} from 'lucide-react';
import { PropertyDocumentDto, UploadDocumentRequestDto } from '@monolith/contracts';

export const DocumentVaultView: React.FC = () => {
  const [documents, setDocuments] = useState<PropertyDocumentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showUploadModal, setShowUploadModal] = useState(false);

  const [uploadForm, setUploadForm] = useState<UploadDocumentRequestDto>({
    propertyId: 'prop-101',
    documentType: 'TITLE_DEED',
    title: '',
    fileUrl: '',
    mimeType: 'application/pdf',
    sizeBytes: 1048576
  });

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const json = await res.json();
        setDocuments(json.data || []);
      } else {
        throw new Error('API unavailable');
      }
    } catch {
      // Demo mock data
      setDocuments([
        {
          id: 'doc-001',
          propertyId: 'prop-101',
          uploaderId: 'owner-me',
          documentType: 'TITLE_DEED',
          title: 'Registered Absolute Sale Deed (Sub-Registrar Bandra)',
          fileUrl: 'https://storage.caretake.io/vault/prop-101-title-deed.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 4200150,
          verificationStatus: 'VERIFIED',
          verifiedBy: 'Legal Advocate S. K. Nair',
          verifiedAt: new Date(Date.now() - 86400000 * 30).toISOString(),
          createdAt: new Date(Date.now() - 86400000 * 35).toISOString()
        },
        {
          id: 'doc-002',
          propertyId: 'prop-101',
          uploaderId: 'owner-me',
          documentType: 'PROPERTY_TAX_RECEIPT',
          title: 'BMC Property Tax Assessment Paid Receipt FY25',
          fileUrl: 'https://storage.caretake.io/vault/bmc-tax-2025.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 980200,
          verificationStatus: 'VERIFIED',
          verifiedBy: 'Compliance Desk',
          verifiedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
          createdAt: new Date(Date.now() - 86400000 * 12).toISOString()
        },
        {
          id: 'doc-003',
          propertyId: 'prop-101',
          uploaderId: 'caretaker-10',
          documentType: 'INSPECTION_REPORT',
          title: 'Pre-Monsoon Structural & Roof Inspection Report',
          fileUrl: 'https://storage.caretake.io/vault/roof-inspection-oct26.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 412000,
          verificationStatus: 'PENDING',
          createdAt: new Date().toISOString()
        },
        {
          id: 'doc-004',
          propertyId: 'prop-102',
          uploaderId: 'owner-me',
          documentType: 'ENCUMBRANCE_CERTIFICATE',
          title: 'Form 15 Encumbrance Certificate (15-Year Search)',
          fileUrl: 'https://storage.caretake.io/vault/ec-certificate.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2510000,
          verificationStatus: 'VERIFIED',
          verifiedBy: 'Legal Advocate S. K. Nair',
          verifiedAt: new Date(Date.now() - 86400000 * 60).toISOString(),
          createdAt: new Date(Date.now() - 86400000 * 65).toISOString()
        },
        {
          id: 'doc-005',
          propertyId: 'prop-102',
          uploaderId: 'tenant-lead',
          documentType: 'LEASE_AGREEMENT',
          title: 'Commercial Lease Agreement Draft 2026-2028',
          fileUrl: 'https://storage.caretake.io/vault/nexus-draft-lease.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1850000,
          verificationStatus: 'PENDING',
          createdAt: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(uploadForm)
      });
      if (res.ok) {
        setShowUploadModal(false);
        loadDocuments();
      } else {
        const newDoc: PropertyDocumentDto = {
          id: `doc-${Date.now()}`,
          propertyId: uploadForm.propertyId,
          uploaderId: 'owner-me',
          documentType: uploadForm.documentType,
          title: uploadForm.title,
          fileUrl: uploadForm.fileUrl,
          mimeType: uploadForm.mimeType,
          sizeBytes: uploadForm.sizeBytes,
          verificationStatus: 'PENDING',
          createdAt: new Date().toISOString()
        };
        setDocuments(prev => [newDoc, ...prev]);
        setShowUploadModal(false);
      }
    } catch {
      setShowUploadModal(false);
    }
  };

  const handleVerifyDecision = async (docId: string, isApproved: boolean) => {
    try {
      await fetch(`/api/documents/${docId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isApproved })
      });
    } finally {
      setDocuments(prev =>
        prev.map(d =>
          d.id === docId
            ? {
                ...d,
                verificationStatus: isApproved ? 'VERIFIED' : 'REJECTED',
                verifiedBy: 'Legal Counsel / Admin',
                verifiedAt: new Date().toISOString()
              }
            : d
        )
      );
    }
  };

  const filteredDocs = selectedType === 'all'
    ? documents
    : documents.filter(d => d.documentType === selectedType);

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Metrics Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
            <FileText size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Vaulted Documents</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>{documents.length} Files</div>
          </div>
        </div>

        <div className="card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Legally Verified</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>
              {documents.filter(d => d.verificationStatus === 'VERIFIED').length} Deeds
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Pending Audit</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>
              {documents.filter(d => d.verificationStatus === 'PENDING').length} Reviews
            </div>
          </div>
        </div>
      </div>

      {/* Header and Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Property Document Vault & Legal Chain of Custody</h2>
          <span style={{ fontSize: '0.8rem', background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', padding: '3px 10px', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.25)' }}>
            FR-DOC
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'rgba(30, 41, 59, 0.7)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem'
            }}
          >
            <option value="all">All Document Types</option>
            <option value="TITLE_DEED">Title Deeds</option>
            <option value="PROPERTY_TAX_RECEIPT">Tax Receipts</option>
            <option value="ENCUMBRANCE_CERTIFICATE">Encumbrance Certificate</option>
            <option value="OCCUPANCY_CERTIFICATE">Occupancy Certificate</option>
            <option value="LEASE_AGREEMENT">Lease Agreements</option>
            <option value="SALE_AGREEMENT">Sale Agreements</option>
            <option value="INSPECTION_REPORT">Inspection Reports</option>
            <option value="CARETAKER_KYC">Caretaker KYC</option>
            <option value="TENANT_ID_PROOF">Tenant ID Proof</option>
          </select>

          <button
            onClick={() => setShowUploadModal(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <Upload size={16} /> Vault New Document
          </button>

          <button
            onClick={loadDocuments}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Document Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
        {filteredDocs.map(doc => (
          <div key={doc.id} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: 'rgba(99, 102, 241, 0.15)',
                    color: '#a5b4fc'
                  }}
                >
                  {doc.documentType}
                </span>

                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background:
                      doc.verificationStatus === 'VERIFIED'
                        ? 'rgba(16, 185, 129, 0.15)'
                        : doc.verificationStatus === 'REJECTED'
                        ? 'rgba(239, 68, 68, 0.15)'
                        : 'rgba(245, 158, 11, 0.15)',
                    color:
                      doc.verificationStatus === 'VERIFIED'
                        ? '#34d399'
                        : doc.verificationStatus === 'REJECTED'
                        ? '#f87171'
                        : '#fbbf24'
                  }}
                >
                  {doc.verificationStatus === 'VERIFIED' && <ShieldCheck size={13} />}
                  {doc.verificationStatus === 'PENDING' && <Clock size={13} />}
                  {doc.verificationStatus === 'REJECTED' && <AlertTriangle size={13} />}
                  {doc.verificationStatus}
                </span>
              </div>

              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '8px', lineHeight: 1.35 }}>
                {doc.title}
              </h4>

              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '16px' }}>
                <div>Property: <strong style={{ color: 'var(--text-primary)' }}>{doc.propertyId}</strong></div>
                <div>Size: {formatFileSize(doc.sizeBytes)} • {doc.mimeType}</div>
                {doc.verifiedBy && (
                  <div style={{ color: '#34d399' }}>Audited by: {doc.verifiedBy}</div>
                )}
              </div>
            </div>

            {/* Actions Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.8rem',
                  color: '#60a5fa',
                  textDecoration: 'none'
                }}
              >
                <Download size={14} /> Open Vault File
              </a>

              {doc.verificationStatus === 'PENDING' && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => handleVerifyDecision(doc.id, true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      background: 'rgba(16, 185, 129, 0.2)',
                      color: '#34d399',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    <Check size={12} /> Verify
                  </button>
                  <button
                    onClick={() => handleVerifyDecision(doc.id, false)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: 'rgba(239, 68, 68, 0.2)',
                      color: '#f87171',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      fontSize: '0.75rem',
                      cursor: 'pointer'
                    }}
                  >
                    <X size={12} /> Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '460px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px' }}>Deposit Document in Vault</h3>
            <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label">Property Reference ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={uploadForm.propertyId}
                  onChange={e => setUploadForm({ ...uploadForm, propertyId: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="form-label">Classification / Type</label>
                <select
                  className="form-input"
                  value={uploadForm.documentType}
                  onChange={e => setUploadForm({ ...uploadForm, documentType: e.target.value as any })}
                >
                  <option value="TITLE_DEED">Title Deed</option>
                  <option value="PROPERTY_TAX_RECEIPT">Property Tax Receipt</option>
                  <option value="ENCUMBRANCE_CERTIFICATE">Encumbrance Certificate</option>
                  <option value="OCCUPANCY_CERTIFICATE">Occupancy Certificate</option>
                  <option value="NOC">No Objection Certificate (NOC)</option>
                  <option value="LEASE_AGREEMENT">Lease Agreement</option>
                  <option value="SALE_AGREEMENT">Sale Agreement</option>
                  <option value="INSPECTION_REPORT">Inspection Report</option>
                  <option value="CARETAKER_KYC">Caretaker KYC</option>
                  <option value="TENANT_ID_PROOF">Tenant ID Proof</option>
                </select>
              </div>

              <div>
                <label className="form-label">Document Title / Nomenclature</label>
                <input
                  type="text"
                  className="form-input"
                  value={uploadForm.title}
                  onChange={e => setUploadForm({ ...uploadForm, title: e.target.value })}
                  placeholder="e.g., Absolute Sale Deed 2021"
                  required
                />
              </div>

              <div>
                <label className="form-label">Secure Storage Cloud URL</label>
                <input
                  type="url"
                  className="form-input"
                  value={uploadForm.fileUrl}
                  onChange={e => setUploadForm({ ...uploadForm, fileUrl: e.target.value })}
                  placeholder="https://storage.caretake.io/..."
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Vault Document
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
