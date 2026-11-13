import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, FileText, RefreshCw, Sliders, KeyRound } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card/Card';
import { Button } from '../../../components/ui/Button/Button';

export const QuickActionsWidget: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader title="Quick Operations" subtitle="Standard daily operational triggers" />
      <CardBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          <Button
            variant="primary"
            fullWidth
            onClick={() => navigate('/records')}
            leftIcon={<PlusCircle size={16} />}
          >
            Create New Record
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => navigate('/iam')}
            leftIcon={<KeyRound size={16} />}
          >
            Identity, SSO & Federation
          </Button>
          <Button
            variant="secondary"
            fullWidth
            onClick={() => navigate('/records')}
            leftIcon={<FileText size={16} />}
          >
            Audit Entity Explorer
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onClick={() => navigate('/settings')}
            leftIcon={<Sliders size={16} />}
          >
            Tenant Config & Branding
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onClick={() => window.location.reload()}
            leftIcon={<RefreshCw size={16} />}
          >
            Sync Live Telemetry
          </Button>
        </div>
      </CardBody>
    </Card>
  );
};
