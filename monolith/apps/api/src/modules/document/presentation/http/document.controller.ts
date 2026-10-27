import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { UploadDocumentUseCase } from '../../application/commands/upload-document.use-case.js';
import { VerifyDocumentUseCase } from '../../application/commands/verify-document.use-case.js';
import { ListDocumentsQuery } from '../../application/queries/list-documents.query.js';
import { getCurrentRequestId } from '../../../../shared/presentation/request-context.js';

const uploadDocumentSchema = z.object({
  propertyId: z.string().min(1),
  documentType: z.enum([
    'TITLE_DEED',
    'PROPERTY_TAX_RECEIPT',
    'ENCUMBRANCE_CERTIFICATE',
    'OCCUPANCY_CERTIFICATE',
    'NOC',
    'LEASE_AGREEMENT',
    'SALE_AGREEMENT',
    'INSPECTION_REPORT',
    'CARETAKER_KYC',
    'TENANT_ID_PROOF'
  ]),
  title: z.string().min(2),
  fileUrl: z.string().url(),
  mimeType: z.string().min(1),
  sizeBytes: z.number().positive()
});

const verifyDocumentSchema = z.object({
  isApproved: z.boolean()
});

export class DocumentController {
  constructor(
    private readonly uploadDocumentUseCase: UploadDocumentUseCase,
    private readonly verifyDocumentUseCase: VerifyDocumentUseCase,
    private readonly listDocumentsQuery: ListDocumentsQuery
  ) {}

  upload = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = uploadDocumentSchema.parse(req.body);
      const uploaderId = req.user!.id;
      const result = await this.uploadDocumentUseCase.execute({ ...validated, uploaderId });

      if (result.isFailure) return next(result.getError());

      res.status(201).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  verify = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const documentId = String(req.params.id);
      const validated = verifyDocumentSchema.parse(req.body);
      const verifiedByActorId = req.user!.id;

      const result = await this.verifyDocumentUseCase.execute({
        documentId,
        verifiedByActorId,
        isApproved: validated.isApproved
      });

      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  listByProperty = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const propertyId = String(req.params.propertyId);
      const result = await this.listDocumentsQuery.execute({ propertyId });

      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };
}
