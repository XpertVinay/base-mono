import { IUseCase } from '../../../../shared/application/use-case.interface.js';
import { Result } from '../../../../shared/domain/result.js';
import { IDocumentRepository } from '../../domain/repositories/document-repository.interface.js';
import { PropertyDocument } from '../../domain/entities/property-document.entity.js';
import { UploadDocumentRequestDto, PropertyDocumentDto } from '@monolith/contracts';

export interface UploadDocumentInput extends UploadDocumentRequestDto {
  uploaderId: string;
}

export class UploadDocumentUseCase implements IUseCase<UploadDocumentInput, PropertyDocumentDto> {
  constructor(private readonly documentRepository: IDocumentRepository) {}

  async execute(input: UploadDocumentInput): Promise<Result<PropertyDocumentDto, Error>> {
    try {
      const doc = PropertyDocument.create(
        input.propertyId,
        input.uploaderId,
        input.documentType,
        input.title,
        input.fileUrl,
        input.mimeType,
        input.sizeBytes
      );

      await this.documentRepository.save(doc);

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
        createdAt: doc.createdAt.toISOString()
      });
    } catch (err: any) {
      return Result.fail(err);
    }
  }
}
