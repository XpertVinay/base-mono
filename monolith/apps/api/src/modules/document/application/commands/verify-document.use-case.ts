import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IDocumentRepository } from '../../domain/repositories/document-repository.interface.js';
import { PropertyDocumentDto } from '@monolith/contracts';

export interface VerifyDocumentInput {
  documentId: string;
  verifiedByActorId: string;
  isApproved: boolean;
}

export class VerifyDocumentUseCase implements IUseCase<VerifyDocumentInput, PropertyDocumentDto> {
  constructor(private readonly documentRepository: IDocumentRepository) {}

  async execute(input: VerifyDocumentInput): Promise<Result<PropertyDocumentDto, Error>> {
    try {
      const doc = await this.documentRepository.findById(input.documentId);
      if (!doc) {
        return Result.fail(new Error(`Document ${input.documentId} not found`));
      }

      if (input.isApproved) {
        doc.verify(input.verifiedByActorId);
      } else {
        doc.reject(input.verifiedByActorId);
      }

      await this.documentRepository.update(doc);

      return Result.ok({
        id: doc.id,
        propertyId: doc.propertyId,
        uploaderId: doc.uploaderId,
        documentType: doc.documentType,
        title: doc.title,
        fileUrl: doc.fileUrl,
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
        verificationStatus: doc.verificationStatus,
        verifiedBy: doc.verifiedBy || undefined,
        verifiedAt: doc.verifiedAt ? doc.verifiedAt.toISOString() : undefined,
        createdAt: doc.createdAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
