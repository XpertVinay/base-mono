import { Request, Response, NextFunction } from 'express';
import { GetGatewayHealthQuery, GetGatewayRoutesQuery } from '../../application/use-cases/gateway.use-cases.js';
import { getCurrentRequestId } from '../../../../shared/presentation/request-context.js';

export class GatewayController {
  constructor(
    private readonly healthQuery: GetGatewayHealthQuery,
    private readonly routesQuery: GetGatewayRoutesQuery
  ) {}

  live = (_req: Request, res: Response): void => {
    res.status(200).json({
      status: 'UP',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    });
  };

  ready = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.healthQuery.execute();
      if (result.isFailure) return next(result.getError());

      const data = result.getValue();
      const statusCode = data.status === 'UP' ? 200 : 503;
      res.status(statusCode).json(data);
    } catch (err) {
      next(err);
    }
  };

  routes = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.routesQuery.execute();
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
}
