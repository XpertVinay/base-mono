import {
  INotificationAdapter,
  SendNotificationInput,
  SendNotificationOutput
} from '../../application/ports/notification-adapter.port.js';
import {
  NotificationChannel,
  NotificationConfigDto,
  ChannelProviderConfigDto
} from '@monolith/contracts';
import { logger } from '../../../../shared/infrastructure/logger.js';
import { env } from '../../../../config/env.js';

export type NotificationConfigResolver = (key: string, defaultValue?: string, tenantId?: string) => Promise<string>;

export class DynamicNotificationRouter {
  private adapters = new Map<string, INotificationAdapter>();

  constructor(
    private readonly configResolver?: NotificationConfigResolver,
    initialAdapters: INotificationAdapter[] = []
  ) {
    initialAdapters.forEach(adapter => this.registerAdapter(adapter));
  }

  public registerAdapter(adapter: INotificationAdapter): void {
    this.adapters.set(adapter.providerName.toUpperCase().trim(), adapter);
  }

  public getAdapter(providerName: string): INotificationAdapter | undefined {
    return this.adapters.get(providerName.toUpperCase().trim());
  }

  public getAvailableProviders(): string[] {
    return Array.from(this.adapters.keys());
  }

  public async isDryRunEnabled(tenantId?: string): Promise<boolean> {
    if (this.configResolver) {
      try {
        const val = await this.configResolver('NOTIFICATION_DRY_RUN', String(env.NOTIFICATION_DRY_RUN), tenantId);
        return val === 'true' || val === '1';
      } catch {
        // Fall back to environment variable
      }
    }
    return Boolean(env.NOTIFICATION_DRY_RUN);
  }

  public async getActiveProviderForChannel(channel: NotificationChannel, tenantId?: string): Promise<string> {
    const envKeyMap: Record<NotificationChannel, { key: string; defaultVal: string }> = {
      EMAIL: { key: 'NOTIFICATION_EMAIL_PROVIDER', defaultVal: env.NOTIFICATION_EMAIL_PROVIDER || 'SENDGRID' },
      SMS: { key: 'NOTIFICATION_SMS_PROVIDER', defaultVal: env.NOTIFICATION_SMS_PROVIDER || 'TWILIO' },
      WHATSAPP: { key: 'NOTIFICATION_WHATSAPP_PROVIDER', defaultVal: env.NOTIFICATION_WHATSAPP_PROVIDER || 'META_CLOUD' },
      PUSH: { key: 'NOTIFICATION_PUSH_PROVIDER', defaultVal: env.NOTIFICATION_PUSH_PROVIDER || 'FCM' },
      IN_APP: { key: 'NOTIFICATION_IN_APP_PROVIDER', defaultVal: 'MOCK' }
    };

    const mapping = envKeyMap[channel] || { key: 'NOTIFICATION_EMAIL_PROVIDER', defaultVal: 'MOCK' };

    if (this.configResolver) {
      try {
        if (tenantId) {
          const tenantVal = await this.configResolver(`${tenantId}_${mapping.key}`, '', tenantId);
          if (tenantVal && tenantVal.trim().length > 0) {
            return tenantVal.toUpperCase().trim();
          }
        }
        return (await this.configResolver(mapping.key, mapping.defaultVal, tenantId)).toUpperCase().trim();
      } catch {
        return mapping.defaultVal.toUpperCase().trim();
      }
    }
    return mapping.defaultVal.toUpperCase().trim();
  }

  public async getActiveAdapterForChannel(channel: NotificationChannel, tenantId?: string): Promise<INotificationAdapter> {
    const providerName = await this.getActiveProviderForChannel(channel, tenantId);
    const adapter = this.adapters.get(providerName);

    if (adapter && adapter.supportedChannels.includes(channel)) {
      return adapter;
    }

    // Try finding any adapter that supports this channel
    for (const regAdapter of this.adapters.values()) {
      if (regAdapter.supportedChannels.includes(channel) && regAdapter.providerName !== 'MOCK') {
        return regAdapter;
      }
    }

    // Fall back to MOCK adapter
    return this.adapters.get('MOCK') || Array.from(this.adapters.values())[0]!;
  }

  public async dispatch(input: SendNotificationInput): Promise<SendNotificationOutput> {
    const globalDryRun = await this.isDryRunEnabled(input.tenantId);

    let targetAdapter: INotificationAdapter;

    if (input.provider) {
      const explicitAdapter = this.adapters.get(input.provider.toUpperCase().trim());
      if (explicitAdapter) {
        targetAdapter = explicitAdapter;
      } else {
        logger.warn(`Explicit provider '${input.provider}' requested but not registered. Selecting channel default.`, {
          channel: input.channel,
          requestedProvider: input.provider
        });
        targetAdapter = await this.getActiveAdapterForChannel(input.channel, input.tenantId);
      }
    } else {
      targetAdapter = await this.getActiveAdapterForChannel(input.channel, input.tenantId);
    }

    const isAdapterConfigured = targetAdapter.isConfigured();
    const effectiveDryRun = input.dryRun !== undefined ? input.dryRun : globalDryRun;

    if (!isAdapterConfigured && !effectiveDryRun) {
      logger.warn(
        `Provider '${targetAdapter.providerName}' is not configured with production credentials. Attempting live dispatch as requested.`,
        { channel: input.channel, recipient: input.recipient, tenantId: input.tenantId }
      );
    }

    return targetAdapter.send({
      ...input,
      dryRun: effectiveDryRun
    });
  }

  public async getConfigSummary(tenantId?: string): Promise<NotificationConfigDto> {
    const globalDryRun = await this.isDryRunEnabled(tenantId);
    const channels: NotificationChannel[] = ['EMAIL', 'SMS', 'WHATSAPP', 'PUSH', 'IN_APP'];

    const channelConfigs: Record<NotificationChannel, ChannelProviderConfigDto> = {} as any;

    for (const ch of channels) {
      const activeProvider = await this.getActiveProviderForChannel(ch, tenantId);
      const adapter = this.adapters.get(activeProvider);
      const isConfigured = adapter ? adapter.isConfigured() : false;

      const supportedProviders = Array.from(this.adapters.values())
        .filter(a => a.supportedChannels.includes(ch))
        .map(a => a.providerName as string);

      channelConfigs[ch] = {
        channel: ch,
        activeProvider,
        isConfigured,
        isDryRun: globalDryRun || !isConfigured,
        supportedProviders
      };
    }

    return {
      globalDryRun,
      environment: process.env.NODE_ENV || 'development',
      channels: channelConfigs
    };
  }
}
