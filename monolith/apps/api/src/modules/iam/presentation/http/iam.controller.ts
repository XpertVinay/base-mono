import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { RegisterUserUseCase } from '../../application/commands/register-user.use-case.js';
import { LoginUserUseCase } from '../../application/commands/login-user.use-case.js';
import { RefreshTokenUseCase } from '../../application/commands/refresh-token.use-case.js';
import { GetUserByIdQuery } from '../../application/queries/get-user-by-id.query.js';
import { SetupMfaUseCase } from '../../application/commands/mfa/setup-mfa.use-case.js';
import { EnableMfaUseCase } from '../../application/commands/mfa/enable-mfa.use-case.js';
import { VerifyMfaUseCase } from '../../application/commands/mfa/verify-mfa.use-case.js';
import { ReverifyMfaUseCase } from '../../application/commands/mfa/reverify-mfa.use-case.js';
import { DisableMfaUseCase } from '../../application/commands/mfa/disable-mfa.use-case.js';
import { GetMfaStatusQuery } from '../../application/queries/get-mfa-status.query.js';
import { SsoLoginUseCase } from '../../application/commands/sso/sso-login.use-case.js';
import { GetAuditLogsQuery } from '../../application/queries/get-audit-logs.query.js';
import { ManageProtectedRoutesUseCase } from '../../application/commands/mfa/manage-protected-routes.use-case.js';
import { getCurrentRequestId } from '../../../../shared/presentation/request-context.js';
import { extractClientContext } from '../../../../shared/presentation/auth.middleware.js';
import { tokenService } from '../../../../shared/infrastructure/token.service.js';
import { env } from '../../../../config/env.js';

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().min(2).max(100),
  role: z.enum(['ADMIN', 'USER', 'AUDITOR', 'OWNER', 'CARETAKER', 'TENANT', 'BUYER', 'VENDOR', 'AGENT', 'LEGAL']).optional(),
  tenantId: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
  tenantId: z.string().optional()
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1)
});

const enableMfaSchema = z.object({
  code: z.string().min(6).max(10),
  secret: z.string().min(16),
  backupCodes: z.array(z.string()).optional()
});

const verifyMfaSchema = z.object({
  mfaChallengeToken: z.string().min(1),
  code: z.string().min(6).max(10)
});

const reverifyMfaSchema = z.object({
  code: z.string().min(6).max(10)
});

const disableMfaSchema = z.object({
  code: z.string().min(6).max(10),
  password: z.string().optional()
});

const ssoInitiateSchema = z.object({
  provider: z.enum(['google', 'azure-ad', 'okta', 'mock-sso']).default('mock-sso'),
  redirectUri: z.string().url().optional()
});

const ssoCallbackSchema = z.object({
  provider: z.string().min(1),
  state: z.string().min(1),
  code: z.string().optional(),
  idToken: z.string().optional(),
  mockProfile: z.object({
    email: z.string().email(),
    name: z.string(),
    subjectId: z.string().optional()
  }).optional()
});

const createProtectedRouteSchema = z.object({
  method: z.string().default('*'),
  pathPattern: z.string().min(1),
  description: z.string().optional(),
  reverificationMode: z.enum(['SESSION_24H', 'EVERY_TIME']).default('SESSION_24H')
});

export class IamController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUserUseCase: LoginUserUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly getUserByIdQuery: GetUserByIdQuery,
    private readonly setupMfaUseCase?: SetupMfaUseCase,
    private readonly enableMfaUseCase?: EnableMfaUseCase,
    private readonly verifyMfaUseCase?: VerifyMfaUseCase,
    private readonly reverifyMfaUseCase?: ReverifyMfaUseCase,
    private readonly disableMfaUseCase?: DisableMfaUseCase,
    private readonly getMfaStatusQuery?: GetMfaStatusQuery,
    private readonly ssoLoginUseCase?: SsoLoginUseCase,
    private readonly getAuditLogsQuery?: GetAuditLogsQuery,
    private readonly manageProtectedRoutesUseCase?: ManageProtectedRoutesUseCase
  ) { }

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = registerSchema.parse(req.body);
      const canAssignRole = req.user?.role === 'ADMIN' || env.NODE_ENV !== 'production';
      const role = (canAssignRole && validated.role) ? validated.role : 'USER';
      const result = await this.registerUserUseCase.execute({ ...validated, role });

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(201).json({
        success: true,
        data: result.getValue(),
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = loginSchema.parse(req.body);
      const clientContext = extractClientContext(req);
      const result = await this.loginUserUseCase.execute({ ...validated, clientContext });

      if (result.isFailure) {
        return next(result.getError());
      }

      const value = result.getValue();
      const status = 'mfaRequired' in value && value.mfaRequired ? 200 : 200;

      res.status(status).json({
        success: true,
        data: value,
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = refreshSchema.parse(req.body);
      const clientContext = extractClientContext(req);
      const result = await this.refreshTokenUseCase.execute({ ...validated, clientContext });

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const result = await this.getUserByIdQuery.execute({ id: userId });

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  // -------------------------------------------------------------
  // MFA Feature Endpoints
  // -------------------------------------------------------------

  setupMfa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const clientContext = extractClientContext(req);
      const result = await this.setupMfaUseCase!.execute({ userId, clientContext });

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  enableMfa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const validated = enableMfaSchema.parse(req.body);
      const clientContext = extractClientContext(req);
      const result = await this.enableMfaUseCase!.execute({
        userId,
        code: validated.code,
        secret: validated.secret,
        backupCodes: validated.backupCodes,
        clientContext
      });

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  verifyMfa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = verifyMfaSchema.parse(req.body);
      const clientContext = extractClientContext(req);
      const result = await this.verifyMfaUseCase!.execute({
        mfaChallengeToken: validated.mfaChallengeToken,
        code: validated.code,
        clientContext
      });

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  reverifyMfa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const validated = reverifyMfaSchema.parse(req.body);
      const clientContext = extractClientContext(req);
      const result = await this.reverifyMfaUseCase!.execute({
        userId,
        code: validated.code,
        clientContext
      });

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  disableMfa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const validated = disableMfaSchema.parse(req.body);
      const clientContext = extractClientContext(req);
      const result = await this.disableMfaUseCase!.execute({
        userId,
        code: validated.code,
        password: validated.password,
        clientContext
      });

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  getMfaStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const result = await this.getMfaStatusQuery!.execute({ userId });

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  // -------------------------------------------------------------
  // SSO Endpoints
  // -------------------------------------------------------------

  ssoInitiate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = ssoInitiateSchema.parse(req.body);
      const clientContext = extractClientContext(req);
      const result = await this.ssoLoginUseCase!.initiate(validated, clientContext);

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  ssoCallback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = ssoCallbackSchema.parse(req.body);
      const clientContext = extractClientContext(req);
      const result = await this.ssoLoginUseCase!.callback(validated, clientContext);

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  // -------------------------------------------------------------
  // Audit Logs & Protected Routes Management
  // -------------------------------------------------------------

  getAuditLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId, eventType, status, limit, offset } = req.query;
      const result = await this.getAuditLogsQuery!.execute({
        userId: userId as string,
        eventType: eventType as string,
        status: status as any,
        limit: limit ? parseInt(limit as string, 10) : 50,
        offset: offset ? parseInt(offset as string, 10) : 0
      });

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  listProtectedRoutes = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.manageProtectedRoutesUseCase!.listRoutes();
      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  addProtectedRoute = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = createProtectedRouteSchema.parse(req.body);
      const result = await this.manageProtectedRoutesUseCase!.addRoute(validated, req.user?.id);

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(201).json({
        success: true,
        data: result.getValue(),
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  deleteProtectedRoute = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const result = await this.manageProtectedRoutesUseCase!.removeRoute(id, req.user?.id);

      if (result.isFailure) {
        return next(result.getError());
      }

      res.status(200).json({
        success: true,
        data: { id, deleted: result.getValue() },
        meta: {
          requestId: getCurrentRequestId(),
          timestamp: new Date().toISOString()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  getJwks = async (_req: Request, res: Response): Promise<void> => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).json(tokenService.getJwks());
  };

  getPublicKey = async (_req: Request, res: Response): Promise<void> => {
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).send(tokenService.getPublicKeyPem());
  };
}
