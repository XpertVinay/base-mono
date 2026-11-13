import React from 'react';
import { Outlet } from 'react-router-dom';
import {
  ShieldCheck,
  Lock,
  Shield,
  Activity,
  Quote,
} from 'lucide-react';
import { DevTenantSwitcher } from '../core/tenant/DevTenantSwitcher';
import { LanguageSwitcher } from '../components/common/LanguageSwitcher';
import { TenantLogo } from '../components/common/TenantLogo';
import { useTenant } from '../core/tenant/TenantContext';
import styles from './AuthLayout.module.css';

export const AuthLayout: React.FC = () => {
  const { tenant } = useTenant();

  const getIndustryShowcase = () => {
    switch (tenant.industry) {
      case 'healthcare':
        return {
          portalBadge: 'HEALTHCARE CLOUD V3.4',
          headline: `The unified clinical intelligence and telemetry platform for ${tenant.identity.displayName}.`,
          description:
            'Deliver compliant patient care, HIPAA-certified clinical telemetry, and high-assurance medical workflows under a hardened zero-trust posture.',
          slaTitle: 'Clinical EHR & Telemetry Availability',
          slaPill: '99.99% HIPAA SLA',
          metric1: 'Latency p99: 14ms',
          metric2: 'HIPAA Audited (Zero Breach)',
          quote: `"${tenant.identity.displayName} modernized our patient care coordination across 12 facilities. Diagnostic turnaround dropped by 65% with zero downtime."`,
          authorName: 'Dr. Evelyn Marcus',
          authorRole: 'Chief Medical Informatics Officer',
          authorInitials: 'EM',
          badges: ['HIPAA Certified', 'SOC2 Type II', '256-bit SSL Encrypted'],
        };
      case 'logistics':
        return {
          portalBadge: 'LOGISTICS FLEET CORE V3.4',
          headline: `The mission-critical freight dispatch and fleet operations platform for ${tenant.identity.displayName}.`,
          description:
            'Orchestrate real-time fleet telematics, freight consignment routes, and multi-modal shipment dispatch across continental transportation hubs.',
          slaTitle: 'Fleet Telematics & Route Dispatch',
          slaPill: '99.95% Dispatch SLA',
          metric1: 'Active Telematics: 3,840 units',
          metric2: 'On-Route Accuracy: 98.7%',
          quote: `"${tenant.identity.displayName} gives our dispatchers instantaneous visibility into thousands of transit corridors with automated re-routing."`,
          authorName: 'Marcus Sterling',
          authorRole: 'VP of Global Fleet Logistics',
          authorInitials: 'MS',
          badges: ['DOT & FMCSA Compliant', 'ISO 27001 Certified', 'Fleet SSL Protected'],
        };
      case 'fintech':
        return {
          portalBadge: 'INSTITUTIONAL CLEARING V3.4',
          headline: `The institutional clearing and multi-asset wealth management platform for ${tenant.identity.displayName}.`,
          description:
            'Execute microsecond clearing, algorithmic portfolio risk balancing, and institutional asset custody with cryptographic ledger verification.',
          slaTitle: 'Institutional Clearing Availability',
          slaPill: '99.999% SLA',
          metric1: 'Clearing Latency: 4ms',
          metric2: 'Real-time Gross Settled',
          quote: `"${tenant.identity.displayName} powers our active trading desks with instant atomic settlement and cryptographic compliance audits."`,
          authorName: 'Alexander Wright',
          authorRole: 'Head of Quantitative Trading',
          authorInitials: 'AW',
          badges: ['PCI-DSS Level 1', 'SOC2 Type II Certified', 'FINRA / SEC Hardened'],
        };
      default:
        return {
          portalBadge: 'ENTERPRISE PORTAL V3.4',
          headline: `The unified operations platform for ${tenant.identity.displayName}.`,
          description:
            'Centralize distributed cluster observation, multi-cloud deployments, and cryptographic posture under one high-fidelity control plane.',
          slaTitle: 'Global Edge Availability',
          slaPill: '99.99% Uptime SLA',
          metric1: 'Latency p99: 18ms',
          metric2: 'Zero Incident Window (90d)',
          quote: `"${tenant.identity.displayName} cut our deployment triage time to under 90 seconds. It is the definitive operating bedrock for our operations."`,
          authorName: 'Alex Vance',
          authorRole: 'VP of Platform Operations',
          authorInitials: 'AV',
          badges: ['SOC2 Type II Certified', '256-bit SSL Encrypted', 'ISO 27001 Compliant'],
        };
    }
  };

  const showcase = getIndustryShowcase();

  return (
    <div className={styles.container}>
      {/* Left Column: Enterprise Brand & Trust Showcase (White-Label Dynamic) */}
      <div className={styles.showcaseColumn}>
        <div className={styles.ambientGlowTop} />
        <div className={styles.ambientGlowBottom} />

        {/* Top Section: Brand Identity & SLA Spark */}
        <div className={styles.showcaseTop}>
          <div className={styles.brandIdentityRow}>
            <TenantLogo size={36} showText={false} />
            <div className={styles.brandMeta}>
              <span className={styles.brandTitle}>{tenant.identity.displayName}</span>
              <span className={styles.brandSubtitle}>
                {tenant.industry.toUpperCase()} PLATFORM CORE
              </span>
            </div>
          </div>

          <div className={styles.portalBadge}>
            <span className={styles.liveDot} />
            <span className={styles.portalBadgeText}>{showcase.portalBadge}</span>
          </div>

          <h1 className={styles.showcaseHeadline}>{showcase.headline}</h1>

          <p className={styles.showcaseDescription}>{showcase.description}</p>

          {/* Telemetry & SLA Spark Module */}
          <div className={styles.telemetryCard}>
            <div className={styles.telemetryHeader}>
              <div className={styles.telemetryTitle}>
                <Activity size={16} style={{ color: 'var(--color-primary)' }} />
                <span>{showcase.slaTitle}</span>
              </div>
              <span className={styles.telemetrySlaPill}>{showcase.slaPill}</span>
            </div>

            <svg className={styles.sparklineSvg} fill="none" preserveAspectRatio="none" viewBox="0 0 280 40">
              <path
                d="M0 32 L20 28 L40 30 L60 22 L80 25 L100 18 L120 20 L140 12 L160 16 L180 10 L200 14 L220 8 L240 10 L260 4 L280 6"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
              />
              <path
                d="M0 32 L20 28 L40 30 L60 22 L80 25 L100 18 L120 20 L140 12 L160 16 L180 10 L200 14 L220 8 L240 10 L260 4 L280 6 V40 H0 Z"
                fill="currentColor"
                fillOpacity="0.08"
              />
            </svg>

            <div className={styles.telemetryFooter}>
              <span>{showcase.metric1}</span>
              <span>{showcase.metric2}</span>
            </div>
          </div>
        </div>

        {/* Middle Section: Executive Testimonial */}
        <div className={styles.quoteCard}>
          <Quote size={20} style={{ color: 'var(--color-primary)', opacity: 0.5, marginBottom: '8px' }} />
          <p className={styles.quoteText}>{showcase.quote}</p>
          <div className={styles.quoteAuthor}>
            <div className={styles.quoteAvatar}>{showcase.authorInitials}</div>
            <div className={styles.authorDetails}>
              <span className={styles.authorName}>{showcase.authorName}</span>
              <span className={styles.authorRole}>{showcase.authorRole}</span>
            </div>
          </div>
        </div>

        {/* Bottom Section: Security & Compliance Badges */}
        <div className={styles.complianceRow}>
          {showcase.badges.map((badgeText, idx) => (
            <div key={idx} className={styles.complianceBadge}>
              {idx === 0 ? (
                <ShieldCheck size={14} className={styles.complianceIcon} />
              ) : idx === 1 ? (
                <Lock size={14} className={styles.complianceIcon} />
              ) : (
                <Shield size={14} className={styles.complianceIcon} />
              )}
              <span>{badgeText}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Column: Interactive Auth Form Column */}
      <div className={styles.formColumn}>
        <div className={styles.topBar}>
          <DevTenantSwitcher />
          <LanguageSwitcher />
        </div>

        <div className={styles.formContentWrapper}>
          <Outlet />
        </div>

        <div className={styles.authFooter}>
          &copy; {new Date().getFullYear()} {tenant.identity.legalName}. Enterprise Portal Security.
        </div>
      </div>
    </div>
  );
};
