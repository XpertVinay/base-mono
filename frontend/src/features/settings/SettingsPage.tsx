import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check,
  X,
  Shield,
  Palette,
  Sliders,
  ChevronRight,
  User,
  Lock,
  Bell,
  MapPin,
  Camera,
  Verified,
  Save,
} from 'lucide-react';
import { useTenant } from '../../core/tenant/TenantContext';
import { useAuthStore } from '../../core/auth/authStore';
import { Card, CardHeader, CardBody } from '../../components/ui/Card/Card';
import { Badge } from '../../components/ui/Badge/Badge';
import { Button } from '../../components/ui/Button/Button';
import { Input } from '../../components/ui/Input/Input';
import styles from './SettingsPage.module.css';

type SettingsTab = 'general' | 'security' | 'notifications' | 'branding' | 'features';

export const SettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const { tenant } = useTenant();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [savedNotice, setSavedNotice] = useState(false);

  const getDefaultJobTitle = () => {
    switch (tenant.industry) {
      case 'healthcare':
        return 'Chief Medical Informatics Officer';
      case 'logistics':
        return 'Fleet Operations Director';
      case 'fintech':
        return 'Head of Trading & Portfolio Risk';
      default:
        return 'Platform Architecture Lead';
    }
  };

  const [fullName, setFullName] = useState(user?.name || `${tenant.identity.displayName} Admin`);
  const [jobTitle, setJobTitle] = useState(getDefaultJobTitle());
  const [workEmail, setWorkEmail] = useState(user?.email || `admin@${tenant.identity.slug}.demo`);
  const [locationStr, setLocationStr] = useState(`${tenant.localization.defaultTimeZone} • Regional HQ`);

  useEffect(() => {
    setFullName(user?.name || `${tenant.identity.displayName} Admin`);
    setJobTitle(getDefaultJobTitle());
    setWorkEmail(user?.email || `admin@${tenant.identity.slug}.demo`);
    setLocationStr(`${tenant.localization.defaultTimeZone} • ${tenant.identity.displayName}`);
  }, [tenant.identity.slug, user?.name, user?.email]);

  const handleSave = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div className={styles.container}>
      {/* Page Breadcrumb Navigation (White-Label Dynamic) */}
      <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
        <span>{tenant.identity.displayName}</span>
        <ChevronRight size={13} className={styles.breadcrumbSeparator} />
        <span>Account</span>
        <ChevronRight size={13} className={styles.breadcrumbSeparator} />
        <span className={styles.breadcrumbActive}>Profile Settings</span>
      </nav>

      {/* Header Area with Page Title, Badge & Quick Actions */}
      <div className={styles.headerArea}>
        <div className={styles.headerLeft}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Profile Settings</h1>
            <Badge variant="primary">{tenant.industry.toUpperCase()}</Badge>
          </div>
          <p className={styles.subtitle}>
            Manage your personal profile information, workspace preferences, and security credentials for {tenant.identity.displayName}.
          </p>
        </div>

        <div className={styles.headerActions}>
          <Button
            variant="secondary"
            onClick={() => {
              setFullName(user?.name || `${tenant.identity.displayName} Admin`);
              setWorkEmail(user?.email || `admin@${tenant.identity.slug}.demo`);
            }}
          >
            Discard Changes
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            leftIcon={savedNotice ? <Check size={16} /> : <Save size={16} />}
          >
            {savedNotice ? 'Saved!' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Segmented Tabs Navigation Bar (Stitch Design) */}
      <div className={styles.segmentedTabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'general'}
          className={`${styles.tabBtn} ${activeTab === 'general' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('general')}
        >
          <User size={16} className={styles.tabIcon} />
          <span>General</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'security'}
          className={`${styles.tabBtn} ${activeTab === 'security' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <Lock size={16} className={styles.tabIcon} />
          <span>Security & 2FA</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'notifications'}
          className={`${styles.tabBtn} ${activeTab === 'notifications' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          <Bell size={16} className={styles.tabIcon} />
          <span>Notifications</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'branding'}
          className={`${styles.tabBtn} ${activeTab === 'branding' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('branding')}
        >
          <Palette size={16} className={styles.tabIcon} />
          <span>Branding & Tokens</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'features'}
          className={`${styles.tabBtn} ${activeTab === 'features' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('features')}
        >
          <Sliders size={16} className={styles.tabIcon} />
          <span>Tenant & Features</span>
        </button>
      </div>

      {/* Main 2-Column Responsive Grid */}
      <div className={styles.layoutGrid}>
        {/* Left Column (4 cols): Profile Card & Identity Card */}
        <div className={styles.leftCol}>
          {/* User Profile Header Card */}
          <div className={styles.profileCard}>
            <div className={styles.profileCardBackdrop} />

            <div className={styles.avatarContainer}>
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={fullName} className={styles.avatarImage} />
              ) : (
                <div className={styles.avatarFallback}>
                  {fullName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
              )}
              <button
                type="button"
                className={styles.cameraBtn}
                title="Change profile photo"
                aria-label="Change profile photo"
              >
                <Camera size={14} />
              </button>
            </div>

            <div className={styles.profileNameRow}>
              <h2 className={styles.profileName}>{fullName}</h2>
              <Badge variant="primary">PRO</Badge>
            </div>

            <p className={styles.profileRoleText}>{jobTitle}</p>
            <p className={styles.profileMetaText}>
              <MapPin size={13} style={{ color: 'var(--color-muted)' }} />
              <span>{locationStr}</span>
            </p>
            <p className={styles.profileEmailText}>{workEmail}</p>

            {/* Quick Stats Grid */}
            <div className={styles.quickStatsGrid}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Role</span>
                <span className={styles.statValue}>{user?.role || 'Admin'}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Joined</span>
                <span className={styles.statValue}>Mar 2022</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>2FA</span>
                <span className={styles.statValue} style={{ color: 'var(--color-success)' }}>Active</span>
              </div>
            </div>

            {/* Profile Completeness Bar */}
            <div className={styles.completionBox}>
              <div className={styles.completionHeader}>
                <span>Profile Completeness</span>
                <span className={styles.completionValue}>92%</span>
              </div>
              <div className={styles.progressBarTrack}>
                <div className={styles.progressBarFill} style={{ width: '92%' }} />
              </div>
              <span className={styles.completionHint}>
                Add your hardware security key to reach 100% verification.
              </span>
            </div>
          </div>

          {/* Tenant Identity & Legal Registration Card */}
          <Card>
            <CardHeader
              title={t('settings.tenantDetails', 'Tenant Identity')}
              subtitle="Organization identifier and registration"
              action={<Verified size={18} style={{ color: 'var(--color-primary)' }} />}
            />
            <CardBody>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className={styles.tokenRow}>
                  <span>Tenant Slug</span>
                  <code style={{ color: 'var(--color-primary)', fontWeight: 600 }}>{tenant.identity.slug}</code>
                </div>
                <div className={styles.tokenRow}>
                  <span>Tenant ID</span>
                  <code>{tenant.identity.id}</code>
                </div>
                <div className={styles.tokenRow}>
                  <span>Legal Entity</span>
                  <span>{tenant.identity.legalName}</span>
                </div>
                <div className={styles.tokenRow}>
                  <span>Support Email</span>
                  <span>{tenant.identity.supportEmail}</span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right Column (8 cols): Tab Content Cards */}
        <div className={styles.rightCol}>
          {activeTab === 'general' && (
            <Card>
              <CardHeader
                title="Personal Information"
                subtitle="Update your photo, personal details and workspace settings"
              />
              <CardBody>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <Input
                      label="Full Name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                    <Input
                      label="Job Title"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <Input
                      label="Enterprise Work Email"
                      type="email"
                      value={workEmail}
                      onChange={(e) => setWorkEmail(e.target.value)}
                      helperText="Directory linked account"
                    />
                    <Input
                      label="Location / Office"
                      value={locationStr}
                      onChange={(e) => setLocationStr(e.target.value)}
                    />
                  </div>

                  <Input
                    label="Default Timezone"
                    value={tenant.localization.defaultTimeZone}
                    disabled
                    helperText="Configured via tenant policy"
                  />
                </div>
              </CardBody>
            </Card>
          )}

          {activeTab === 'security' && (
            <Card>
              <CardHeader
                title="Security & Authentication Credentials"
                subtitle="Manage hardware security keys, MFA, and active cryptographic posture"
                action={<Shield size={18} style={{ color: 'var(--color-success)' }} />}
              />
              <CardBody>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className={styles.tokenRow}>
                    <div>
                      <strong>Hardware Key (FIDO2 / WebAuthn)</strong>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                        YubiKey 5C NFC enrolled
                      </p>
                    </div>
                    <Badge variant="success">Enrolled</Badge>
                  </div>

                  <div className={styles.tokenRow}>
                    <div>
                      <strong>Two-Factor Authentication (TOTP)</strong>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                        Google Authenticator or 1Password
                      </p>
                    </div>
                    <Badge variant="success">Enabled</Badge>
                  </div>

                  <div className={styles.tokenRow}>
                    <div>
                      <strong>Session Inactivity Timeout</strong>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                        Automatic logout upon idle detection
                      </p>
                    </div>
                    <code>{tenant.runtime.sessionTimeoutMinutes} minutes</code>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card>
              <CardHeader
                title="Notification Preferences"
                subtitle="Select alerts and delivery channels for mission-critical events"
                action={<Bell size={18} style={{ color: 'var(--color-primary)' }} />}
              />
              <CardBody>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className={styles.tokenRow}>
                    <div>
                      <strong>Critical Security Alerts</strong>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                        Instant SMS and email on anomalous login attempts
                      </p>
                    </div>
                    <Badge variant="primary">Required</Badge>
                  </div>

                  <div className={styles.tokenRow}>
                    <div>
                      <strong>Audit Log & Compliance Reports</strong>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                        Daily digest sent to compliance officer
                      </p>
                    </div>
                    <Badge variant="success">Active</Badge>
                  </div>

                  <div className={styles.tokenRow}>
                    <div>
                      <strong>Deployment & Service Health Alerts</strong>
                      <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--color-text-secondary)' }}>
                        Real-time webhooks on service degradation
                      </p>
                    </div>
                    <Badge variant="success">Active</Badge>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Always available or on branding tab: Live CSS Tokens */}
          {(activeTab === 'branding' || activeTab === 'general') && (
            <Card>
              <CardHeader
                title={t('settings.brandingTokens', 'Dynamic CSS Custom Properties')}
                subtitle="Live design tokens injected into :root"
                action={<Palette size={18} style={{ color: 'var(--color-primary)' }} />}
              />
              <CardBody>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className={styles.tokenRow}>
                    <span>--color-primary</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <code>{tenant.branding.primaryColor}</code>
                      <div
                        className={styles.colorSwatch}
                        style={{ backgroundColor: tenant.branding.primaryColor }}
                      />
                    </div>
                  </div>

                  <div className={styles.tokenRow}>
                    <span>--color-secondary</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <code>{tenant.branding.secondaryColor}</code>
                      <div
                        className={styles.colorSwatch}
                        style={{ backgroundColor: tenant.branding.secondaryColor }}
                      />
                    </div>
                  </div>

                  <div className={styles.tokenRow}>
                    <span>--color-accent</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <code>{tenant.branding.accentColor}</code>
                      <div
                        className={styles.colorSwatch}
                        style={{ backgroundColor: tenant.branding.accentColor }}
                      />
                    </div>
                  </div>

                  <div className={styles.tokenRow}>
                    <span>--color-surface</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <code>{tenant.branding.surfaceColor}</code>
                      <div
                        className={styles.colorSwatch}
                        style={{ backgroundColor: tenant.branding.surfaceColor }}
                      />
                    </div>
                  </div>

                  <div className={styles.tokenRow}>
                    <span>--font-family</span>
                    <code>{tenant.branding.fontFamily}</code>
                  </div>

                  <div className={styles.tokenRow}>
                    <span>--radius-md</span>
                    <code>{tenant.branding.borderRadius}</code>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Features Tab */}
          {(activeTab === 'features' || activeTab === 'general') && (
            <Card>
              <CardHeader
                title={t('settings.featureGates', 'Feature Module Toggles')}
                subtitle="Dynamic runtime feature gating per tenant policy"
                action={<Sliders size={18} style={{ color: 'var(--color-primary)' }} />}
              />
              <CardBody>
                <div className={styles.featureList}>
                  {Object.entries(tenant.features.enabledFeatures).map(([featureKey, enabled]) => (
                    <div key={featureKey} className={styles.featureCard}>
                      <span>{featureKey}</span>
                      {enabled ? (
                        <Check size={16} style={{ color: 'var(--color-success)' }} />
                      ) : (
                        <X size={16} style={{ color: 'var(--color-muted)' }} />
                      )}
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};