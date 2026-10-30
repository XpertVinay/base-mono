import { Entity } from '../../../../shared/domain/entity.js';

export type ConfigTarget = 'BACKEND' | 'FRONTEND' | 'ALL';

export interface AppConfigProps {
  value: string;
  description?: string;
  isEncrypted: boolean;
  target?: ConfigTarget;
  updatedAt: Date;
}

export class AppConfig extends Entity<AppConfigProps> {
  private constructor(key: string, props: AppConfigProps) {
    super(key, props);
  }

  get key(): string { return this._id; }
  get value(): string { return this.props.value; }
  get description(): string | undefined { return this.props.description; }
  get isEncrypted(): boolean { return this.props.isEncrypted; }
  get target(): ConfigTarget { return this.props.target || 'ALL'; }
  get updatedAt(): Date { return this.props.updatedAt; }

  public isClientAccessible(): boolean {
    return !this.isEncrypted && (this.target === 'FRONTEND' || this.target === 'ALL');
  }

  public static create(
    key: string,
    value: string,
    description?: string,
    isEncrypted = false,
    target: ConfigTarget = 'ALL'
  ): AppConfig {
    return new AppConfig(key.toUpperCase().trim(), {
      value,
      description,
      isEncrypted,
      target,
      updatedAt: new Date()
    });
  }

  public static reconstitute(key: string, props: AppConfigProps): AppConfig {
    return new AppConfig(key, {
      ...props,
      target: props.target || 'ALL'
    });
  }
}

