import { IQuery } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IIamAuditRepository } from '../../infrastructure/persistence/iam-audit.repository.js';
import { IamAuditLogDto } from '@monolith/contracts';

export interface GetAuditLogsInput {
  userId?: string;
  eventType?: string;
  status?: 'SUCCESS' | 'FAILURE';
  limit?: number;
  offset?: number;
}

export class GetAuditLogsQuery implements IQuery<GetAuditLogsInput, IamAuditLogDto[]> {
  constructor(private readonly auditRepository: IIamAuditRepository) { }

  async execute(input: GetAuditLogsInput): Promise<Result<IamAuditLogDto[], Error>> {
    try {
      const logs = await this.auditRepository.findRecent(input);
      const dtos: IamAuditLogDto[] = logs.map(l => ({
        id: l.id,
        userId: l.userId,
        eventType: l.eventType,
        ipAddress: l.ipAddress,
        userAgent: l.userAgent,
        details: l.details,
        status: l.status,
        createdAt: l.createdAt.toISOString()
      }));

      return Result.ok(dtos);
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
