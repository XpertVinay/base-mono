import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { RegisterUserUseCase } from '../../application/commands/register-user.use-case.js';
import { LoginUserUseCase } from '../../application/commands/login-user.use-case.js';
import { GetUserByIdQuery } from '../../application/queries/get-user-by-id.query.js';
import { ApiResponse } from '../../shared/presentation/standard-response.js';

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
        ApiResponse.error(res, {
          req,
          statusCode: 400,
          message: result.getError(),
          errors: [{ code: 'REGISTRATION_FAILED', message: result.getError() }],
          meta: { further_steps: ['Try with a different email address'] }
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 201,
        message: 'User registered successfully',
        data: result.getValue(),
        meta: { further_steps: ['Log in at POST /api/v1/iam/login to receive an access token'] }
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
        ApiResponse.error(res, {
          req,
          statusCode: 401,
          message: result.getError(),
          errors: [{ code: 'INVALID_CREDENTIALS', message: result.getError() }],
          meta: { further_steps: ['Verify your password or request a reset'] }
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'Authentication successful',
        data: result.getValue(),
        meta: { further_steps: ['Pass the returned token in the Authorization: Bearer <token> header'] }
      });
    } catch (err) {
      next(err);
    }
  };

  getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        ApiResponse.error(res, {
          req,
          statusCode: 401,
          message: 'Authentication required',
          errors: [{ code: 'UNAUTHORIZED', message: 'No valid user session found' }]
        });
        return;
      }

      const result = await this.getUserByIdQuery.execute({ userId });
      if (result.isFailure) {
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'NOT_FOUND', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'User profile retrieved successfully',
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
        ApiResponse.error(res, {
          req,
          statusCode: 404,
          message: result.getError(),
          errors: [{ code: 'NOT_FOUND', message: result.getError() }]
        });
        return;
      }

      ApiResponse.success(res, {
        req,
        statusCode: 200,
        message: 'User retrieved successfully',
        data: result.getValue()
      });
    } catch (err) {
      next(err);
    }
  };
}
