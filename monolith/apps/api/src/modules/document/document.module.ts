import { Router } from 'express';
import { PostgresDocumentRepository } from './infrastructure/persistence/postgres-document.repository.js';
import { UploadDocumentUseCase } from './application/commands/upload-document.use-case.js';
import { VerifyDocumentUseCase } from './application/commands/verify-document.use-case.js';
import { ListDocumentsQuery } from './application/queries/list-documents.query.js';
import { DocumentController } from './presentation/http/document.controller.js';
import { createDocumentRouter } from './presentation/http/document.routes.js';
import { container } from '../../bootstrap/container.js';
import { PropertyDocumentDto } from '@monolith/contracts';

export interface IDocumentModulePublicApi {
  getDocumentsForProperty(propertyId: string): Promise<PropertyDocumentDto[]>;
}

export class DocumentModule {
  public static init(): { router: Router; publicApi: IDocumentModulePublicApi } {
    const repository = new PostgresDocumentRepository();
    const uploadDocumentUseCase = new UploadDocumentUseCase(repository);
    const verifyDocumentUseCase = new VerifyDocumentUseCase(repository);
    const listDocumentsQuery = new ListDocumentsQuery(repository);

    const controller = new DocumentController(
      uploadDocumentUseCase,
      verifyDocumentUseCase,
      listDocumentsQuery
    );
    const router = createDocumentRouter(controller);

    const publicApi: IDocumentModulePublicApi = {
      getDocumentsForProperty: async (propertyId: string) => {
        const docs = await repository.findByPropertyId(propertyId);
        return docs.map(doc => ({
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
      }
    };

    container.register('IDocumentModulePublicApi', publicApi);
    return { router, publicApi };
  }
}
