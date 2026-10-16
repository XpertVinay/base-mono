import { Router } from 'express';
import { IamModule } from '../modules/iam/index.js';
import { AssetModule } from '../modules/asset/index.js';
import { ConfigModule } from '../modules/config/index.js';
import { NotificationModule } from '../modules/notification/index.js';
import { SchedulerModule } from '../modules/scheduler/index.js';
import { OrderModule } from '../modules/order/index.js';
import { TransactionModule } from '../modules/transaction/index.js';
import { SearchModule } from '../modules/search/index.js';
import { InventoryModule } from '../modules/inventory/index.js';
import { GatewayModule } from '../modules/gateway/index.js';
import { logger } from '../shared/infrastructure/logger.js';

export interface ModuleRegistryResult {
  routers: {
    iam: Router;
    asset: Router;
    config: Router;
    notification: Router;
    scheduler: Router;
    order: Router;
    transaction: Router;
    search: Router;
    inventory: Router;
    gateway: Router;
  };
  gatewayController: any;
}

export function registerAllModules(): ModuleRegistryResult {
  logger.info('Registering business modules...');

  // 1. IAM
  const iam = IamModule.init();
  // 2. Asset
  const asset = AssetModule.init();
  // 3. Config
  const config = ConfigModule.init();
  // 4. Notification
  const notification = NotificationModule.init();
  // 5. Scheduler
  const scheduler = SchedulerModule.init();
  // 6. Order
  const order = OrderModule.init();
  // 7. Transaction
  const transaction = TransactionModule.init();
  // 8. Search
  const search = SearchModule.init();
  // 9. Inventory
  const inventory = InventoryModule.init();
  // 10. Gateway
  const gateway = GatewayModule.init();

  logger.info('All 10 business modules initialized and wired successfully');

  return {
    routers: {
      iam: iam.router,
      asset: asset.router,
      config: config.router,
      notification: notification.router,
      scheduler: scheduler.router,
      order: order.router,
      transaction: transaction.router,
      search: search.router,
      inventory: inventory.router,
      gateway: gateway.router
    },
    gatewayController: gateway.controller
  };
}
