import React, { useState } from 'react';
import {
  Building2,
  Sliders,
  ShieldCheck,
  Bell,
  Database,
  ExternalLink,
  Activity,
  RefreshCw,
  ChevronRight,
  ShoppingCart,
  Boxes,
  FolderArchive,
  CreditCard,
  CalendarClock,
  Lock,
} from 'lucide-react';
import { apiClient } from '../../core/api/client';
import { useApiTrafficStore } from '../../core/api/trafficStore';
import { Button } from '../../components/ui/Button/Button';
import {
  OrganizationsTab,
  ConfigTab,
  RbacTab,
  NotificationsTab,
  OrdersTab,
  InventoryTab,
  AssetsTab,
  TransactionsTab,
  SchedulerTab,
  MfaCryptoTab,
  RecordsTab,
} from './tabs';
import styles from './ApiExplorerPage.module.css';

export type ExplorerTab =
  | 'organizations'
  | 'config'
  | 'rbac'
  | 'notifications'
  | 'orders'
  | 'inventory'
  | 'assets'
  | 'transactions'
  | 'scheduler'
  | 'mfa-crypto'
  | 'records';

export const ApiExplorerPage: React.FC = () => {
  const { toggleDrawer, records: trafficRecords } = useApiTrafficStore();

  const [activeTab, setActiveTab] = useState<ExplorerTab>('organizations');

  // Ping Health state
  const [healthStatus, setHealthStatus] = useState<{
    status: string;
    durationMs: number;
    time: string;
  } | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  // Health Ping
  const handlePingBackend = async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      const res = await apiClient.get<Record<string, unknown>>('/health');
      const durationMs = Math.round(performance.now() - start);
      setHealthStatus({
        status:
          res.data?.status === true || (res.data?.data as Record<string, unknown>)?.status ? 'HEALTHY (200 OK)' : 'OK',
        durationMs,
        time: new Date().toLocaleTimeString(),
      });
    } catch (e: unknown) {
      const durationMs = Math.round(performance.now() - start);
      const errMsg = e instanceof Error ? e.message : 'Unknown error';
      setHealthStatus({
        status: `OFFLINE / FALLBACK: ${errMsg}`,
        durationMs,
        time: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsPinging(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Breadcrumbs */}
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <span>Workspace</span>
        <ChevronRight size={13} />
        <span className={styles.breadcrumbActive}>API Operations &amp; CRUD Workbench</span>
      </nav>

      {/* Header Row */}
      <div className={styles.headerRow}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>API Operations &amp; Live CRUD Workbench</h1>
          <p className={styles.subtitle}>
            Interactive CRUD operations and telemetric communication testing for{' '}
            <code>http://localhost:4000/api-docs/</code>
          </p>
        </div>

        <div className={styles.headerActions}>
          <a
            href="http://localhost:4000/api-docs/"
            target="_blank"
            rel="noreferrer"
            style={{ textDecoration: 'none' }}
          >
            <Button variant="outline" size="sm" leftIcon={<ExternalLink size={14} />}>
              Open Swagger UI (:4000)
            </Button>
          </a>

          <Button
            variant="primary"
            size="sm"
            onClick={toggleDrawer}
            leftIcon={<Activity size={14} />}
          >
            Traffic Inspector ({trafficRecords.length})
          </Button>
        </div>
      </div>

      {/* Health Check Banner */}
      <div className={styles.healthBanner}>
        <div className={styles.healthLeft}>
          <span className={styles.healthDot} />
          <div>
            <div className={styles.healthText}>
              <strong>Target Ingress Gateway:</strong> <code>http://localhost:4000</code> &bull; Unified REST &amp; gRPC
            </div>
            {healthStatus && (
              <div className={styles.healthMeta}>
                Status: {healthStatus.status} | Roundtrip Latency: {healthStatus.durationMs}ms | Checked: {healthStatus.time}
              </div>
            )}
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handlePingBackend}
          disabled={isPinging}
          leftIcon={<RefreshCw size={13} className={isPinging ? 'animate-spin' : ''} />}
        >
          {isPinging ? 'Testing…' : 'Ping Gateway'}
        </Button>
      </div>

      {/* Tabs */}
      <div className={styles.tabBar} role="tablist" aria-label="API Explorer Tabs">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'organizations'}
          className={`${styles.tabBtn} ${activeTab === 'organizations' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('organizations')}
        >
          <Building2 size={15} /> Organizations CRUD
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'config'}
          className={`${styles.tabBtn} ${activeTab === 'config' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('config')}
        >
          <Sliders size={15} /> Dynamic Config CRUD
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'rbac'}
          className={`${styles.tabBtn} ${activeTab === 'rbac' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('rbac')}
        >
          <ShieldCheck size={15} /> RBAC Roles CRUD
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'notifications'}
          className={`${styles.tabBtn} ${activeTab === 'notifications' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          <Bell size={15} /> Notifications &amp; Outbox
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'orders'}
          className={`${styles.tabBtn} ${activeTab === 'orders' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('orders')}
        >
          <ShoppingCart size={15} /> Orders CRUD
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'inventory'}
          className={`${styles.tabBtn} ${activeTab === 'inventory' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('inventory')}
        >
          <Boxes size={15} /> Inventory CRUD
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'assets'}
          className={`${styles.tabBtn} ${activeTab === 'assets' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('assets')}
        >
          <FolderArchive size={15} /> Assets CRUD
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'transactions'}
          className={`${styles.tabBtn} ${activeTab === 'transactions' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          <CreditCard size={15} /> Transactions CRUD
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'scheduler'}
          className={`${styles.tabBtn} ${activeTab === 'scheduler' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('scheduler')}
        >
          <CalendarClock size={15} /> Scheduler CRUD
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'mfa-crypto'}
          className={`${styles.tabBtn} ${activeTab === 'mfa-crypto' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('mfa-crypto')}
        >
          <Lock size={15} /> MFA &amp; Cryptographic Keys
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'records'}
          className={`${styles.tabBtn} ${activeTab === 'records' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('records')}
        >
          <Database size={15} /> Tenant Data Records
        </button>
      </div>

      {/* Section Content */}
      <div className={styles.sectionCard}>
        {activeTab === 'organizations' && <OrganizationsTab />}
        {activeTab === 'config' && <ConfigTab />}
        {activeTab === 'rbac' && <RbacTab />}
        {activeTab === 'notifications' && <NotificationsTab />}
        {activeTab === 'orders' && <OrdersTab />}
        {activeTab === 'inventory' && <InventoryTab />}
        {activeTab === 'assets' && <AssetsTab />}
        {activeTab === 'transactions' && <TransactionsTab />}
        {activeTab === 'scheduler' && <SchedulerTab />}
        {activeTab === 'mfa-crypto' && <MfaCryptoTab />}
        {activeTab === 'records' && <RecordsTab />}
      </div>
    </div>
  );
};
