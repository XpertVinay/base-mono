import { Entity } from '../../shared/domain/entity.js';

export interface ConfigProps {
  tenantId?: string;
  value: string;
  description?: string;
  isEncrypted: boolean;
  updatedAt?: Date;
}

export class ConfigSetting extends Entity<ConfigProps> {
  private constructor(props: ConfigProps, key: string) {
    super(props, key);
  }

  public static create(key: string, props: ConfigProps): ConfigSetting {
    return new ConfigSetting(
      {
        ...props,
        tenantId: props.tenantId || 'default',
        updatedAt: props.updatedAt || new Date()
      },
      key
    );
  }

  get key(): string { return this._id; }
  get tenantId(): string { return this.props.tenantId || 'default'; }
  get value(): string { return this.props.value; }
  get description(): string | undefined { return this.props.description; }
  get isEncrypted(): boolean { return this.props.isEncrypted; }
  get updatedAt(): Date { return this.props.updatedAt!; }

  public updateValue(value: string): void {
    this.props.value = value;
    this.props.updatedAt = new Date();
  }
}
