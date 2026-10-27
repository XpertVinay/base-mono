import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IDocumentRepository } from '../../domain/repositories/document-repository.interface.js';
import { PropertyDocumentDto } from '@monolith/contracts';

export interface ListDocumentsInput {
  propertyId: string;
}

export class ListDocumentsQuery implements IUseCase<ListDocumentsInput, PropertyDocumentDto[]> {
  constructor(private readonly documentRepository: IDocumentRepository) {}

  async execute(input: ListDocumentsInput): Promise<Result<PropertyDocumentDto[], Error>> {
    try {
      const docs = await this.documentRepository.findByPropertyId(input.propertyId);
      const dtos: PropertyDocumentDto[] = docs.map(doc => ({
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
      }));

      return Result.ok(dtos);
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
