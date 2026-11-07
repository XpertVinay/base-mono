import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  ProcessPaymentUseCase,
  InitiatePaymentUseCase,
  HandlePaymentWebhookUseCase,
  RefundTransactionUseCase,
  GetTransactionByIdQuery,
  ListTenantTransactionsQuery,
  ListMyTransactionsQuery
} from '../../application/use-cases/transaction.use-cases.js';
import { DynamicPaymentGatewayRouter } from '../../infrastructure/adapters/dynamic-payment-gateway.router.js';
import { getCurrentRequestId } from '../../../../shared/presentation/request-context.js';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError
} from '../../../../shared/presentation/error-handler.middleware.js';

function extractTenantId(req: Request, required = false): string | undefined {
  const tenantId = (req as any).tenantId || req.headers['x-tenant-id'];
  if (typeof tenantId === 'string' && tenantId.trim().length > 0) {
    return tenantId.trim();
  }
  if (required) {
    throw new BadRequestError('Tenant context is required (missing X-Tenant-ID header)');
  }
  return undefined;
}

const initiatePaymentSchema = z.object({
  referenceId: z.string().min(1, 'Reference ID is required'),
  amount: z.number().positive('Amount must be greater than zero'),
  currency: z.string().optional().default('USD'),
  paymentMethod: z.string().optional(),
  returnUrl: z.string().optional(),
  cancelUrl: z.string().optional()
});

const processPaymentSchema = z.object({
  referenceId: z.string().min(1, 'Reference ID is required'),
  amount: z.number().positive('Amount must be greater than zero'),
  currency: z.string().optional().default('USD'),
  paymentMethod: z.string().optional().default('CREDIT_CARD')
});

const refundSchema = z.object({
  reason: z.string().optional(),
  amount: z.number().positive('Refund amount must be positive').optional()
});

export class TransactionController {
  constructor(
    private readonly initiatePaymentUseCase: InitiatePaymentUseCase,
    private readonly handlePaymentWebhookUseCase: HandlePaymentWebhookUseCase,
    private readonly processPaymentUseCase: ProcessPaymentUseCase,
    private readonly refundTransactionUseCase: RefundTransactionUseCase,
    private readonly getTransactionByIdQuery: GetTransactionByIdQuery,
    private readonly listTenantTransactionsQuery: ListTenantTransactionsQuery,
    private readonly listMyTransactionsQuery: ListMyTransactionsQuery,
    private readonly gatewayRouter: DynamicPaymentGatewayRouter
  ) {}

  initiate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = initiatePaymentSchema.parse(req.body);
      const tenantId = extractTenantId(req, false);
      const userId = req.user!.id;
      const customerEmail = req.user!.email;

      const result = await this.initiatePaymentUseCase.execute({
        ...validated,
        tenantId,
        userId,
        customerEmail
      });

      if (result.isFailure) return next(result.getError());

      res.status(201).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  pay = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = processPaymentSchema.parse(req.body);
      const tenantId = extractTenantId(req, false);
      const userId = req.user!.id;

      const result = await this.processPaymentUseCase.execute({
        ...validated,
        tenantId,
        userId
      });

      if (result.isFailure) return next(result.getError());

      res.status(201).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  handleWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawProv = req.params.provider;
      const provider = (Array.isArray(rawProv) ? rawProv[0] : rawProv || 'STRIPE')!.toUpperCase();
      const tenantId = extractTenantId(req, false);

      const signature =
        (req.headers['stripe-signature'] as string) ||
        (req.headers['x-razorpay-signature'] as string) ||
        (req.headers['signature'] as string) ||
        (req.headers['x-signature'] as string);

      const rawBody = (req as any).rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

      const payload = {
        body: req.body,
        headers: req.headers as Record<string, string | string[] | undefined>,
        query: req.query as Record<string, string | string[] | undefined>,
        rawBody
      };

      const result = await this.handlePaymentWebhookUseCase.execute({
        provider,
        payload,
        rawBody,
        signature,
        tenantId
      });

      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  getTransaction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const tenantId = extractTenantId(req, false);
      const userId = req.user!.id;
      const userRole = (req.user as any)?.role || '';

      const result = await this.getTransactionByIdQuery.execute({ id, tenantId });
      if (result.isFailure) return next(result.getError());

      const transaction = result.getValue();
      if (!transaction) {
        throw new NotFoundError(`Transaction ${id} not found`);
      }

      // Isolation check: if user is not admin/owner, they must own the transaction
      const isPrivileged = ['ADMIN', 'ORGANIZATION_OWNER', 'FINANCE_CONTROLLER'].includes(userRole);
      if (!isPrivileged && transaction.userId !== userId) {
        throw new ForbiddenError('You are not authorized to view this transaction');
      }

      res.status(200).json({
        success: true,
        data: transaction,
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  listTenantTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = extractTenantId(req, true)!;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

      const result = await this.listTenantTransactionsQuery.execute({ tenantId, limit, offset });
      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue().transactions,
        meta: {
          total: result.getValue().total,
          limit,
          offset,
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  listMyTransactions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const tenantId = extractTenantId(req, false);

      const result = await this.listMyTransactionsQuery.execute({ userId, tenantId });
      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  refund = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const tenantId = extractTenantId(req, false);
      const userId = req.user!.id;
      const validated = refundSchema.parse(req.body);

      const result = await this.refundTransactionUseCase.execute({
        transactionId: id,
        tenantId,
        userId,
        reason: validated.reason,
        amount: validated.amount
      });

      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  getGateways = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tenantId = extractTenantId(req, false);
      const activeAdapter = await this.gatewayRouter.getActiveAdapter(tenantId);
      const availableGateways = this.gatewayRouter.getAvailableGateways();

      res.status(200).json({
        success: true,
        data: {
          activeGateway: activeAdapter.providerName,
          availableGateways
        },
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  renderGatewaySimulator = (req: Request, res: Response): void => {
    const { sessionId, provider, amount, currency, referenceId, transactionId, returnUrl, cancelUrl } = req.query;
    const provName = String(provider || 'STRIPE').toUpperCase();

    const providerThemes: Record<string, { color: string; label: string }> = {
      STRIPE: { color: '#635BFF', label: 'Stripe Checkout' },
      PAYPAL: { color: '#0070BA', label: 'PayPal Checkout' },
      RAZORPAY: { color: '#0C2340', label: 'Razorpay Standard' },
      MOCK: { color: '#10B981', label: 'Monolith Mock Payment' }
    };

    const theme = providerThemes[provName] ?? providerThemes['MOCK']!;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; script-src-attr 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'"
    );
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${theme.label} - Hosted Gateway Simulation</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background-color: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; width: 100%; max-width: 480px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); }
    .header { background: ${theme.color}; padding: 24px; color: white; display: flex; justify-content: space-between; align-items: center; }
    .header h2 { font-size: 1.25rem; font-weight: 700; }
    .badge { background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
    .body { padding: 24px; display: flex; flex-direction: column; gap: 20px; }
    .detail-row { display: flex; justify-content: space-between; font-size: 0.9rem; padding-bottom: 12px; border-bottom: 1px solid #334155; }
    .detail-label { color: #94a3b8; }
    .detail-val { font-weight: 600; }
    .amount-box { text-align: center; padding: 20px; background: rgba(15, 23, 42, 0.6); border-radius: 8px; border: 1px solid #334155; }
    .amount-title { font-size: 0.8rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .amount-val { font-size: 2rem; font-weight: 800; color: #38bdf8; }
    .info-box { background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 8px; padding: 12px; font-size: 0.8rem; color: #bae6fd; line-height: 1.4; }
    .btn { display: block; width: 100%; padding: 14px; border: none; border-radius: 8px; font-size: 1rem; font-weight: 700; cursor: pointer; transition: opacity 0.2s; }
    .btn:hover { opacity: 0.9; }
    .btn-pay { background: ${theme.color}; color: white; margin-bottom: 10px; }
    .btn-cancel { background: transparent; color: #94a3b8; border: 1px solid #475569; }
    .btn-cancel:hover { background: #334155; color: white; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <h2>${theme.label}</h2>
        <div style="font-size: 0.8rem; opacity: 0.9;">Secure Provider Checkout Simulation</div>
      </div>
      <span class="badge">SANDBOX HOSTED</span>
    </div>

    <div class="body">
      <div class="amount-box">
        <div class="amount-title">Total Amount to Pay</div>
        <div class="amount-val">$${Number(amount || 0).toFixed(2)} ${String(currency || 'USD')}</div>
      </div>

      <div>
        <div class="detail-row">
          <span class="detail-label">Order Reference:</span>
          <span class="detail-val">#${String(referenceId || '').substring(0, 12)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Monolith Transaction ID:</span>
          <span class="detail-val" style="font-family: monospace; font-size: 0.8rem;">${String(transactionId || '').substring(0, 16)}...</span>
        </div>
        <div class="detail-row" style="border: none;">
          <span class="detail-label">Provider Session:</span>
          <span class="detail-val" style="font-family: monospace; font-size: 0.8rem;">${String(sessionId || '').substring(0, 16)}...</span>
        </div>
      </div>

      <div class="info-box">
        <strong>Gateway Redirection Flow:</strong><br/>
        Clicking <em>"Complete Payment"</em> sends an authentic asynchronous Webhook to the backend <code>/api/transactions/webhooks/${provName.toLowerCase()}</code>, updating the order to <strong>PAID</strong>, and redirects your browser to the application return URL.
      </div>

      <div>
        <button id="payBtn" class="btn btn-pay" type="button">
          ✓ Approve & Complete Payment
        </button>
        <button id="cancelBtn" class="btn btn-cancel" type="button">
          ✕ Decline / Cancel Transaction
        </button>
      </div>
    </div>
  </div>

  <script>
    document.addEventListener('DOMContentLoaded', function() {
      var payBtn = document.getElementById('payBtn');
      var cancelBtn = document.getElementById('cancelBtn');

      payBtn.addEventListener('click', function() {
        payBtn.disabled = true;
        payBtn.innerText = 'Processing simulated webhook...';

        fetch('/api/transactions/webhooks/${provName.toLowerCase()}', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'payment.captured',
            type: 'checkout.session.completed',
            id: 'sim_evt_' + Date.now(),
            client_reference_id: '${encodeURIComponent(String(transactionId || ''))}',
            transactionId: '${encodeURIComponent(String(transactionId || ''))}',
            amount_total: ${Math.round(Number(amount || 0) * 100)},
            currency: '${String(currency || 'USD')}',
            status: 'SUCCESS'
          })
        }).then(function() {
          window.location.href = '${String(returnUrl || '/')}';
        }).catch(function() {
          window.location.href = '${String(returnUrl || '/')}';
        });
      });

      cancelBtn.addEventListener('click', function() {
        window.location.href = '${String(cancelUrl || '/')}';
      });
    });
  </script>
</body>
</html>`);
  };
}
