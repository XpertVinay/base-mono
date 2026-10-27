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
import { PropertyModule } from '../modules/property/index.js';
import { CaretakingModule } from '../modules/caretaking/index.js';
import { MaintenanceModule } from '../modules/maintenance/index.js';
import { RentalModule } from '../modules/rental/index.js';
import { DocumentModule } from '../modules/document/index.js';
import { FinanceModule } from '../modules/finance/index.js';
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
    property: Router;
    caretaking: Router;
    maintenance: Router;
    rental: Router;
    document: Router;
    finance: Router;
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
  // 11. Property
  const property = PropertyModule.init();
  // 12. Caretaking
  const caretaking = CaretakingModule.init();
  // 13. Maintenance (Equilibrium Engine)
  const maintenance = MaintenanceModule.init();
  // 14. Rental
  const rental = RentalModule.init();
  // 15. Document
  const document = DocumentModule.init();
  // 16. Finance
  const finance = FinanceModule.init();

  logger.info('All business modules initialized and wired successfully');

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
      gateway: gateway.router,
      property: property.router,
      caretaking: caretaking.router,
      maintenance: maintenance.router,
      rental: rental.router,
      document: document.router,
      finance: finance.router
    },
    gatewayController: gateway.controller
  };
}
