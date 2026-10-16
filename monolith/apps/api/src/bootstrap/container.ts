import { logger } from '../shared/infrastructure/logger.js';

export class Container {
  private static instance: Container;
  private services = new Map<string, any>();
  private factories = new Map<string, () => any>();

  public static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  public register<T>(token: string, instance: T): void {
    this.services.set(token, instance);
    logger.debug(`Registered service: ${token}`);
  }

  public registerFactory<T>(token: string, factory: () => T): void {
    this.factories.set(token, factory);
  }

  public resolve<T>(token: string): T {
    if (this.services.has(token)) {
      return this.services.get(token) as T;
    }

    if (this.factories.has(token)) {
      const factory = this.factories.get(token)!;
      const instance = factory();
      this.services.set(token, instance); // Cache singleton
      return instance as T;
    }

    throw new Error(`Service '${token}' not registered in dependency injection container`);
  }

  public clear(): void {
    this.services.clear();
    this.factories.clear();
  }
}

export const container = Container.getInstance();
