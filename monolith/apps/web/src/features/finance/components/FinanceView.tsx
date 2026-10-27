import React, { useState, useEffect } from 'react';
import {
  Plus,
  CheckCircle2,
  Clock,
  DollarSign,
  Receipt,
  RefreshCw
} from 'lucide-react';
import { ExpenseRecordDto, CreateExpenseRequestDto } from '@monolith/contracts';

export const FinanceView: React.FC = () => {
  const [expenses, setExpenses] = useState<ExpenseRecordDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  const [expenseForm, setExpenseForm] = useState<CreateExpenseRequestDto>({
    propertyId: 'prop-101',
    payeeName: '',
    expenseType: 'MAINTENANCE_REPAIR',
    amount: 3500,
    description: '',
    invoiceUrl: ''
  });

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/finance/expenses');
      if (res.ok) {
        const json = await res.json();
        setExpenses(json.data || []);
      } else {
        throw new Error('API unavailable');
      }
    } catch {
      // Demo mock data
      setExpenses([
        {
          id: 'exp-101',
          propertyId: 'prop-101',
          creatorId: 'caretaker-10',
          payeeName: 'Speedy Plumbers & Sanitary Co',
          expenseType: 'MAINTENANCE_REPAIR',
          amount: 4800,
          description: 'Emergency bathroom valve replacement and gasket repair',
          invoiceUrl: 'https://storage.caretake.io/invoices/valve-repair.pdf',
          status: 'SETTLED',
          approvedBy: 'owner-me',
          approvedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
          settledAt: new Date(Date.now() - 86400000 * 4).toISOString(),
          createdAt: new Date(Date.now() - 86400000 * 6).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 4).toISOString()
        },
        {
          id: 'exp-102',
          propertyId: 'prop-101',
          creatorId: 'caretaker-10',
          payeeName: 'City Water & Sewerage Board',
          expenseType: 'UTILITY_BILL',
          amount: 2250,
          description: 'Monthly municipal water charges - October 2026',
          invoiceUrl: 'https://storage.caretake.io/invoices/water-oct26.pdf',
          status: 'APPROVED',
          approvedBy: 'owner-me',
          approvedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
          createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
          updatedAt: new Date(Date.now() - 86400000 * 1).toISOString()
        },
        {
          id: 'exp-103',
          propertyId: 'prop-102',
          creatorId: 'caretaker-10',
          payeeName: 'Precision Lift Maintenance Ltd',
          expenseType: 'MAINTENANCE_REPAIR',
          amount: 14500,
          description: 'Elevator quarterly servicing & brake caliper testing',
          invoiceUrl: 'https://storage.caretake.io/invoices/lift-servicing.pdf',
          status: 'PENDING_APPROVAL',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'exp-104',
          propertyId: 'prop-101',
          creatorId: 'caretaker-10',
          payeeName: 'Pest Shield Bangalore',
          expenseType: 'MAINTENANCE_REPAIR',
          amount: 3200,
          description: 'Termite inspection and perimeter spray',
          status: 'PENDING_APPROVAL',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/finance/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expenseForm)
      });
      if (res.ok) {
        setShowAddModal(false);
        loadExpenses();
      } else {
        const newExp: ExpenseRecordDto = {
          id: `exp-${Date.now()}`,
          propertyId: expenseForm.propertyId,
          creatorId: 'owner-me',
          payeeName: expenseForm.payeeName,
          expenseType: expenseForm.expenseType,
          amount: expenseForm.amount,
          description: expenseForm.description,
          invoiceUrl: expenseForm.invoiceUrl || undefined,
          status: 'PENDING_APPROVAL',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setExpenses(prev => [newExp, ...prev]);
        setShowAddModal(false);
      }
    } catch {
      setShowAddModal(false);
    }
  };

  const handleApprove = async (expenseId: string, isApproved: boolean) => {
    try {
      await fetch(`/api/finance/expenses/${expenseId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isApproved })
      });
    } finally {
      setExpenses(prev =>
        prev.map(e =>
          e.id === expenseId
            ? {
                ...e,
                status: isApproved ? 'APPROVED' : 'REJECTED',
                approvedBy: 'owner-me',
                approvedAt: isApproved ? new Date().toISOString() : undefined,
                updatedAt: new Date().toISOString()
              }
            : e
        )
      );
    }
  };

  const handleSettle = async (expenseId: string) => {
    try {
      await fetch(`/api/finance/expenses/${expenseId}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } finally {
      setExpenses(prev =>
        prev.map(e =>
          e.id === expenseId
            ? {
                ...e,
                status: 'SETTLED',
                settledAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            : e
        )
      );
    }
  };

  const filteredExpenses = statusFilter === 'all'
    ? expenses
    : expenses.filter(e => e.status === statusFilter);

  const totalSettled = expenses
    .filter(e => e.status === 'SETTLED')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalPending = expenses
    .filter(e => e.status === 'PENDING_APPROVAL')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalApproved = expenses
    .filter(e => e.status === 'APPROVED')
    .reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
            <DollarSign size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Settled Disbursals</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>₹{totalSettled.toLocaleString()}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' }}>
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Approved Ready to Settle</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>₹{totalApproved.toLocaleString()}</div>
          </div>
        </div>

        <div className="card" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }}>
            <Clock size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Pending Owner Sign-Off</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800 }}>₹{totalPending.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Financial Ledger & Expense Governance</h2>
          <span style={{ fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', padding: '3px 10px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
            FR-FIN
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              background: 'rgba(30, 41, 59, 0.7)',
              color: 'var(--text-primary)',
              fontSize: '0.85rem'
            }}
          >
            <option value="all">All Statuses</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="SETTLED">Settled</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <Plus size={16} /> Record Expense
          </button>

          <button
            onClick={loadExpenses}
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

      {/* Ledger Table */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '12px' }}>Payee / Purpose</th>
                <th style={{ padding: '12px' }}>Category</th>
                <th style={{ padding: '12px' }}>Property</th>
                <th style={{ padding: '12px' }}>Amount</th>
                <th style={{ padding: '12px' }}>Status</th>
                <th style={{ padding: '12px' }}>Audit Chain</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Owner Governance Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 600 }}>{item.payeeName}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '280px' }}>
                      {item.description}
                    </div>
                    {item.invoiceUrl && (
                      <a
                        href={item.invoiceUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#60a5fa', marginTop: '4px', textDecoration: 'none' }}
                      >
                        <Receipt size={12} /> View Invoice
                      </a>
                    )}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        background: 'rgba(99, 102, 241, 0.15)',
                        color: '#a5b4fc'
                      }}
                    >
                      {item.expenseType}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontWeight: 500 }}>
                    {item.propertyId}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#f8fafc' }}>
                      ₹{item.amount.toLocaleString()}
                    </div>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background:
                          item.status === 'SETTLED'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : item.status === 'APPROVED'
                            ? 'rgba(59, 130, 246, 0.15)'
                            : item.status === 'REJECTED'
                            ? 'rgba(239, 68, 68, 0.15)'
                            : 'rgba(245, 158, 11, 0.15)',
                        color:
                          item.status === 'SETTLED'
                            ? '#34d399'
                            : item.status === 'APPROVED'
                            ? '#60a5fa'
                            : item.status === 'REJECTED'
                            ? '#f87171'
                            : '#fbbf24'
                      }}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {item.approvedBy && <div>Approved by {item.approvedBy}</div>}
                      {item.settledAt && <div style={{ color: '#34d399' }}>Settled on {new Date(item.settledAt).toLocaleDateString()}</div>}
                      {!item.approvedBy && <div>Awaiting owner sign-off</div>}
                    </div>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                      {item.status === 'PENDING_APPROVAL' && (
                        <>
                          <button
                            onClick={() => handleApprove(item.id, true)}
                            style={{
                              padding: '5px 10px',
                              borderRadius: '6px',
                              background: 'rgba(16, 185, 129, 0.2)',
                              color: '#34d399',
                              border: '1px solid rgba(16, 185, 129, 0.3)',
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleApprove(item.id, false)}
                            style={{
                              padding: '5px 8px',
                              borderRadius: '6px',
                              background: 'rgba(239, 68, 68, 0.2)',
                              color: '#f87171',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              fontSize: '0.75rem',
                              cursor: 'pointer'
                            }}
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {item.status === 'APPROVED' && (
                        <button
                          onClick={() => handleSettle(item.id)}
                          style={{
                            padding: '5px 12px',
                            borderRadius: '6px',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            color: '#ffffff',
                            border: 'none',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                          }}
                        >
                          Execute Settlement
                        </button>
                      )}

                      {item.status === 'SETTLED' && (
                        <span style={{ fontSize: '0.75rem', color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={14} /> Settled
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Record Expense */}
      {showAddModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '460px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px' }}>Record New Expense</h3>
            <form onSubmit={handleCreateExpense} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label">Property Reference ID</label>
                <input
                  type="text"
                  className="form-input"
                  value={expenseForm.propertyId}
                  onChange={e => setExpenseForm({ ...expenseForm, propertyId: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="form-label">Payee / Vendor Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={expenseForm.payeeName}
                  onChange={e => setExpenseForm({ ...expenseForm, payeeName: e.target.value })}
                  placeholder="e.g., State Electricity Board"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label">Expense Category</label>
                  <select
                    className="form-input"
                    value={expenseForm.expenseType}
                    onChange={e => setExpenseForm({ ...expenseForm, expenseType: e.target.value as any })}
                  >
                    <option value="MAINTENANCE_REPAIR">Maintenance & Repair</option>
                    <option value="CARETAKER_RETAINER">Caretaker Retainer</option>
                    <option value="EMERGENCY_FLOAT_REPLENISHMENT">Emergency Float Replenishment</option>
                    <option value="PROPERTY_TAX">Property Tax</option>
                    <option value="UTILITY_BILL">Utility Bill</option>
                    <option value="DOCUMENTATION_FEE">Documentation & Legal Fee</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Amount (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={expenseForm.amount}
                    onChange={e => setExpenseForm({ ...expenseForm, amount: Number(e.target.value) })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Description / Remarks</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={expenseForm.description}
                  onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  placeholder="Details of expense..."
                  required
                />
              </div>

              <div>
                <label className="form-label">Invoice / Receipt URL (Optional)</label>
                <input
                  type="url"
                  className="form-input"
                  value={expenseForm.invoiceUrl || ''}
                  onChange={e => setExpenseForm({ ...expenseForm, invoiceUrl: e.target.value })}
                  placeholder="https://storage.caretake.io/..."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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
                  Submit Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
