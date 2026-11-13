import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuditMonitoringApp } from './AuditMonitoringApp.js';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuditMonitoringApp
      standalone={true}
      tenantId="production-enterprise"
    />
  </React.StrictMode>
);
