import React, { useState } from 'react';
import { AuthProvider, useAuth } from '../shared/hooks/useAuth.js';
import { GatewayView } from '../features/gateway/components/GatewayView.js';
import { IamView } from '../features/iam/components/IamView.js';
import { OrderView } from '../features/order/components/OrderView.js';
import { SearchView } from '../features/search/components/SearchView.js';
import { ConfigView } from '../features/config/components/ConfigView.js';
import { NotificationView } from '../features/notification/components/NotificationView.js';
import { SchedulerView } from '../features/scheduler/components/SchedulerView.js';
import { PropertyView } from '../features/property/components/PropertyView.js';
import { CaretakingView } from '../features/caretaking/components/CaretakingView.js';
import { MaintenanceEquilibriumView } from '../features/maintenance/components/MaintenanceEquilibriumView.js';
import { RentalView } from '../features/rental/components/RentalView.js';
import { DocumentVaultView } from '../features/document/components/DocumentVaultView.js';
import { FinanceView } from '../features/finance/components/FinanceView.js';
import {
  Home,
  UserCheck,
  Wrench,
  KeyRound,
  FileBox,
  CreditCard,
  Activity,
  Shield,
  Search,
  Settings,
  Bell,
  Clock,
  Layers,
  CheckCircle2,
  Lock
} from 'lucide-react';

type Tab =
  | 'property'
  | 'caretaking'
  | 'maintenance'
  | 'rental'
  | 'documents'
  | 'finance'
  | 'gateway'
  | 'iam'
  | 'order'
  | 'search'
  | 'config'
  | 'notification'
  | 'scheduler';

const DashboardContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('property');
  const { user, isAuthenticated } = useAuth();

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'property', label: 'Property Portfolio', icon: <Home size={18} /> },
    { id: 'caretaking', label: 'Caretaker Delegations', icon: <UserCheck size={18} /> },
    { id: 'maintenance', label: 'Equilibrium Engine', icon: <Wrench size={18} /> },
    { id: 'rental', label: 'Tenancy & Leads', icon: <KeyRound size={18} /> },
    { id: 'documents', label: 'Document Vault', icon: <FileBox size={18} /> },
    { id: 'finance', label: 'Financial Ledgers', icon: <CreditCard size={18} /> },
    { id: 'iam', label: 'IAM & Security', icon: <Shield size={18} /> },
    { id: 'gateway', label: 'Gateway & Health', icon: <Activity size={18} /> },
    { id: 'search', label: 'Global Search', icon: <Search size={18} /> },
    { id: 'notification', label: 'Notifications', icon: <Bell size={18} /> },
    { id: 'scheduler', label: 'Scheduler', icon: <Clock size={18} /> },
    { id: 'config', label: 'Runtime Config', icon: <Settings size={18} /> }
  ];

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', padding: '24px 20px' }}>
      {/* Top Application Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '28px',
          paddingBottom: '20px',
          borderBottom: '1px solid var(--border-color)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)'
            }}
          >
            <Layers size={24} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em', background: 'linear-gradient(135deg, #f8fafc, #c7d2fe)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Real Estate CareTaking Platform
            </h1>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Remote Asset Preservation • Verified Caretakers • Maintenance Equilibrium Engine
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '20px',
              fontSize: '0.8rem',
              color: 'var(--status-success)',
              fontWeight: 600
            }}
          >
            <span className="pulse-indicator" />
            IN-PROCESS ROUTING
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid var(--border-color)',
              borderRadius: '20px',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)'
            }}
          >
            {isAuthenticated ? (
              <>
                <CheckCircle2 size={14} color="var(--status-success)" />
                <span>{user?.name} ({user?.role})</span>
              </>
            ) : (
              <>
                <Lock size={14} color="var(--text-muted)" />
                <span>Guest Session</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Navigation Tabs Bar */}
      <nav
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '12px',
          marginBottom: '24px'
        }}
      >
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 18px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                fontWeight: isActive ? 700 : 500,
                border: '1px solid',
                borderColor: isActive ? 'var(--brand-primary)' : 'var(--border-color)',
                background: isActive
                  ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.15))'
                  : 'rgba(15, 23, 42, 0.4)',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                boxShadow: isActive ? '0 0 16px rgba(99, 102, 241, 0.25)' : 'none'
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Active Tab View */}
      <main style={{ minHeight: '520px' }}>
        {activeTab === 'property' && <PropertyView />}
        {activeTab === 'caretaking' && <CaretakingView />}
        {activeTab === 'maintenance' && <MaintenanceEquilibriumView />}
        {activeTab === 'rental' && <RentalView />}
        {activeTab === 'documents' && <DocumentVaultView />}
        {activeTab === 'finance' && <FinanceView />}
        {activeTab === 'gateway' && <GatewayView />}
        {activeTab === 'iam' && <IamView />}
        {activeTab === 'order' && <OrderView />}
        {activeTab === 'search' && <SearchView />}
        {activeTab === 'config' && <ConfigView />}
        {activeTab === 'notification' && <NotificationView />}
        {activeTab === 'scheduler' && <SchedulerView />}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <DashboardContent />
    </AuthProvider>
  );
};
