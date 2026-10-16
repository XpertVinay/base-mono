import { Entity } from '../../../../shared/domain/entity.js';

export interface AppConfigProps {
  value: string;
  description?: string;
  isEncrypted: boolean;
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
  get updatedAt(): Date { return this.props.updatedAt; }

  public static create(key: string, value: string, description?: string, isEncrypted = false): AppConfig {
    return new AppConfig(key.toUpperCase().trim(), {
      value,
      description,
      isEncrypted,
      updatedAt: new Date()
    });
  }

  public static reconstitute(key: string, props: AppConfigProps): AppConfig {
    return new AppConfig(key, props);
  }
}
