import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { RegisterUserUseCase } from '../../application/commands/register-user.use-case.js';
import { LoginUserUseCase } from '../../application/commands/login-user.use-case.js';
import { GetUserByIdQuery } from '../../application/queries/get-user-by-id.query.js';
import { getCurrentRequestId } from '../../../../shared/presentation/request-context.js';

import { env } from '../../../../config/env.js';

const registerSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().min(2).max(100),
  role: z.enum(['ADMIN', 'USER', 'AUDITOR']).optional()
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128)
});

export class IamController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUserUseCase: LoginUserUseCase,
    private readonly getUserByIdQuery: GetUserByIdQuery
  ) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = registerSchema.parse(req.body);
      // Security hardening: In production, public registration strictly restricts to USER role
      // Only authenticated ADMINs can assign privileged roles (or non-prod test environments)
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
      const result = await this.loginUserUseCase.execute(validated);

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
}
