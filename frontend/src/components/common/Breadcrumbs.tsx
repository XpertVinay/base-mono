import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import styles from './Breadcrumbs.module.css';

export interface BreadcrumbsProps {
  className?: string;
  separator?: React.ReactNode;
}

const ROUTE_LABELS: Record<string, string> = {
  records: 'Data Records',
  'api-operations': 'API Operations',
  'api-explorer': 'API Explorer',
  analytics: 'Analytics & Insights',
  'audit-monitoring': 'Audit & Observability',
  audit: 'Audit Logs',
  iam: 'IAM & Access Control',
  security: 'Security',
  settings: 'Settings',
  tenants: 'Tenants',
  users: 'Users',
  roles: 'Roles & Permissions',
  sessions: 'SSO Sessions',
  providers: 'IdP Providers',
  orders: 'Orders',
  inventory: 'Inventory',
  organization: 'Organization',
  profile: 'User Profile',
  edit: 'Edit',
  create: 'Create',
  new: 'New',
};

function formatSegmentLabel(segment: string): string {
  // Safely decode percent-encoded URL segments with fallback on malformed URI
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    decoded = segment;
  }

  // Check if identifier (UUID, numeric, or prefixed entity ID)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(decoded);
  const isPrefixedId = /^(ten|usr|ord|inv|role|rec)_[a-zA-Z0-9_-]+$/i.test(decoded);
  const isNumeric = /^\d+$/.test(decoded);

  if (isUuid) {
    return `#${decoded.slice(0, 8)}...`;
  }

  if (isPrefixedId) {
    // Preserve prefixed entity IDs cleanly up to 24 chars (e.g. #ten_apex_health_01)
    return decoded.length > 24 ? `#${decoded.slice(0, 20)}...` : `#${decoded}`;
  }

  if (isNumeric) {
    return `#${decoded}`;
  }

  const lower = decoded.toLowerCase();
  if (ROUTE_LABELS[lower]) {
    return ROUTE_LABELS[lower];
  }

  // Fallback: capitalize words split by hyphens, underscores, or whitespace
  return decoded
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ className, separator }) => {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter(Boolean);

  if (pathnames.length === 0) {
    return (
      <nav aria-label="Breadcrumb" className={`${styles.breadcrumbsNav} ${className || ''}`.trim()}>
        <ol className={styles.list}>
          <li className={styles.item}>
            <span className={styles.current} aria-current="page">
              <Home size={14} className={styles.homeIcon} aria-hidden="true" />
              <span>Home</span>
            </span>
          </li>
        </ol>
      </nav>
    );
  }

  let accumulatedPath = '';
  const items = [
    {
      label: 'Home',
      path: '/',
      isCurrent: false,
      isHome: true,
    },
    ...pathnames.map((segment, index) => {
      accumulatedPath += `/${segment}`;
      return {
        label: formatSegmentLabel(segment),
        path: accumulatedPath,
        isCurrent: index === pathnames.length - 1,
        isHome: false,
      };
    }),
  ];

  return (
    <nav aria-label="Breadcrumb" className={`${styles.breadcrumbsNav} ${className || ''}`.trim()}>
      <ol className={styles.list}>
        {items.map((item, idx) => (
          <li key={item.path} className={styles.item}>
            {idx > 0 && (
              <span className={styles.separatorWrapper} aria-hidden="true">
                {separator || <ChevronRight size={13} className={styles.separator} />}
              </span>
            )}
            {item.isCurrent ? (
              <span className={styles.current} aria-current="page">
                {item.isHome && <Home size={14} className={styles.homeIcon} aria-hidden="true" />}
                <span>{item.label}</span>
              </span>
            ) : (
              <Link to={item.path} className={styles.link}>
                {item.isHome && <Home size={14} className={styles.homeIcon} aria-hidden="true" />}
                <span>{item.label}</span>
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};
