import { Router } from 'express';
import { GetGatewayHealthQuery, GetGatewayRoutesQuery } from './application/use-cases/gateway.use-cases.js';
import { GatewayController } from './presentation/http/gateway.controller.js';
import { createGatewayRouter } from './presentation/http/gateway.routes.js';
import { container } from '../../bootstrap/container.js';

export class GatewayModule {
  public static init(): { router: Router; controller: GatewayController } {
    const healthQuery = new GetGatewayHealthQuery();
    const routesQuery = new GetGatewayRoutesQuery();
    const controller = new GatewayController(healthQuery, routesQuery);
    const router = createGatewayRouter(controller);

    container.register('GatewayController', controller);
    return { router, controller };
  }
}
