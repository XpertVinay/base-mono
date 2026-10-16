import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { RegisterUserUseCase } from '../../application/commands/register-user.use-case.js';
import { LoginUserUseCase } from '../../application/commands/login-user.use-case.js';
import { GetUserByIdQuery } from '../../application/queries/get-user-by-id.query.js';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  role: z.enum(['USER', 'ADMIN', 'SUPPORT']).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export class IamController {
  constructor(
    private readonly registerUseCase: RegisterUserUseCase,
    private readonly loginUseCase: LoginUserUseCase,
    private readonly getUserByIdQuery: GetUserByIdQuery
  ) {}

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = registerSchema.parse(req.body);
      const result = await this.registerUseCase.execute(validated);

      if (result.isFailure) {
        res.status(400).json({
          success: false,
          error: { code: 'REGISTRATION_FAILED', message: result.getError() }
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = loginSchema.parse(req.body);
      const result = await this.loginUseCase.execute(validated);

      if (result.isFailure) {
        res.status(401).json({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: result.getError() }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
        return;
      }

      const result = await this.getUserByIdQuery.execute({ userId });
      if (result.isFailure) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: result.getError() } });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };

  getUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const result = await this.getUserByIdQuery.execute({ userId: id });

      if (result.isFailure) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: result.getError() } });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };
}
