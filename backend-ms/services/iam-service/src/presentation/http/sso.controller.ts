import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  CreateSsoHandoffCodeUseCase,
  ExchangeServiceTokenUseCase,
  InitiateSloLogoutUseCase,
  IntrospectSsoTokenUseCase,
  ListMySsoSessionsQuery,
  RedeemSsoHandoffCodeUseCase
} from '../../application/commands/sso.use-cases.js';
import { ApiResponse } from '../../shared/presentation/standard-response.js';

const handoffSchema = z.object({
  targetService: z.string().min(2).max(128),
  scope: z.string().max(500).optional(),
  codeChallenge: z.string().min(16).max(256).optional(),
  redirectUri: z.string().url().optional()
});

const redeemSchema = z.object({
  code: z.string().min(8),
  targetService: z.string().min(2).max(128),
  codeVerifier: z.string().optional(),
  expectedTenantId: z.string().optional()
});

const exchangeSchema = z.object({
  targetService: z.string().min(2).max(128),
  scope: z.string().max(500).optional(),
  expiresInSeconds: z.number().int().min(30).max(3600).optional()
});

const introspectSchema = z.object({
  token: z.string().min(10),
  expectedTenantId: z.string().optional(),
  expectedAudience: z.string().optional()
});

const logoutSchema = z.object({
  sessionId: z.string().optional(),
  allSessions: z.boolean().optional(),
  postLogoutRedirectUri: z.string().url().optional(),
  state: z.string().optional()
});

export class SsoController {
  constructor(
    private readonly createHandoffUseCase: CreateSsoHandoffCodeUseCase,
    private readonly redeemHandoffUseCase: RedeemSsoHandoffCodeUseCase,
    private readonly exchangeServiceTokenUseCase: ExchangeServiceTokenUseCase,
    private readonly introspectTokenUseCase: IntrospectSsoTokenUseCase,
    private readonly listSessionsQuery: ListMySsoSessionsQuery,
    private readonly initiateSloUseCase: InitiateSloLogoutUseCase
  ) {}

  createHandoff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !req.user.sessionId) {
        ApiResponse.error(res, {
          req,
          statusCode: 401,
          message: 'Active SSO session required',
          errors: [{ code: 'NO_SSO_SESSION', message: 'Sign in first to obtain an SSO session' }]
        });
        return;
      }

      const validated = handoffSchema.parse(req.body);
      const result = await this.createHandoffUseCase.execute({
        sessionId: req.user.sessionId,
        userId: req.user.id,
        tenantId: req.user.tenantId,
        ...validated
      });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError(),
          errors: [{ code: 'SSO_HANDOFF_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 201,
        message: 'One-time SSO handoff code created for target service provider',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  redeemHandoff = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = redeemSchema.parse(req.body);
      const result = await this.redeemHandoffUseCase.execute({
        ...validated,
        expectedTenantId:
          validated.expectedTenantId ||
          (req.tenant?.isDefault === false ? req.tenant.tenantId : undefined)
      });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 401,
          message: result.getError(),
          errors: [{ code: 'SSO_REDEEM_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Audience-scoped service provider token issued',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  exchangeForService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !req.user.sessionId) {
        ApiResponse.error(res, {
          req,
          statusCode: 401,
          message: 'Active SSO session required',
          errors: [{ code: 'NO_SSO_SESSION', message: 'Sign in first to exchange tokens for a service provider' }]
        });
        return;
      }

      const validated = exchangeSchema.parse(req.body);
      const result = await this.exchangeServiceTokenUseCase.execute({
        sessionId: req.user.sessionId,
        userId: req.user.id,
        tenantId: req.user.tenantId,
        ...validated
      });

      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 401,
          message: result.getError(),
          errors: [{ code: 'SSO_EXCHANGE_FAILED', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Audience-scoped service provider token issued',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  introspect = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = introspectSchema.parse(req.body);
      const result = await this.introspectTokenUseCase.execute(validated);

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Token introspection completed',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  listMySessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        ApiResponse.error(res, {
          req,
          statusCode: 401,
          message: 'Authentication required',
          errors: [{ code: 'UNAUTHORIZED', message: 'Authentication required' }]
        });
        return;
      }

      const result = await this.listSessionsQuery.execute({
        userId: req.user.id,
        tenantId: req.user.tenantId
      });

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Active SSO sessions retrieved',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        ApiResponse.error(res, {
          req,
          statusCode: 401,
          message: 'Authentication required',
          errors: [{ code: 'UNAUTHORIZED', message: 'Authentication required' }]
        });
        return;
      }

      const validated = logoutSchema.parse(req.body || {});
      const result = await this.initiateSloUseCase.execute({
        sessionId: validated.sessionId || req.user.sessionId,
        userId: req.user.id,
        tenantId: req.user.tenantId,
        allSessions: validated.allSessions,
        postLogoutRedirectUri: validated.postLogoutRedirectUri,
        state: validated.state
      });

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Single Logout (SLO) completed and session revoked',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };
}

