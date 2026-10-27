import crypto from 'crypto';
import { DocumentType, DocumentVerificationStatus } from '@monolith/contracts';

export class PropertyDocument {
  private constructor(
    public readonly id: string,
    public readonly propertyId: string,
    public readonly uploaderId: string,
    public readonly documentType: DocumentType,
    public title: string,
    public readonly fileUrl: string,
    public readonly mimeType: string,
    public readonly sizeBytes: number,
    private _verificationStatus: DocumentVerificationStatus,
    public verifiedBy: string | null,
    public verifiedAt: Date | null,
    public readonly createdAt: Date
  ) {}

  public static create(
    propertyId: string,
    uploaderId: string,
    documentType: DocumentType,
    title: string,
    fileUrl: string,
    mimeType: string,
    sizeBytes: number
  ): PropertyDocument {
    if (!title || title.trim().length < 2) {
      throw new Error('Document title must be at least 2 characters');
    }
    if (!fileUrl || !fileUrl.startsWith('http')) {
      throw new Error('Valid secure file URL is required');
    }
    if (sizeBytes <= 0) {
      throw new Error('Document file size must be greater than zero bytes');
    }

    return new PropertyDocument(
      crypto.randomUUID(),
      propertyId,
      uploaderId,
      documentType,
      title.trim(),
      fileUrl,
      mimeType,
      sizeBytes,
      'PENDING',
      null,
      null,
      new Date()
    );
  }

  public static reconstruct(props: {
    id: string;
    propertyId: string;
    uploaderId: string;
    documentType: DocumentType;
    title: string;
    fileUrl: string;
    mimeType: string;
    sizeBytes: number;
    verificationStatus: DocumentVerificationStatus;
    verifiedBy: string | null;
    verifiedAt: Date | null;
    createdAt: Date;
  }): PropertyDocument {
    return new PropertyDocument(
      props.id,
      props.propertyId,
      props.uploaderId,
      props.documentType,
      props.title,
      props.fileUrl,
      props.mimeType,
      props.sizeBytes,
      props.verificationStatus,
      props.verifiedBy,
      props.verifiedAt,
      props.createdAt
    );
  }

  public get verificationStatus(): DocumentVerificationStatus {
    return this._verificationStatus;
  }

  public verify(verifiedByActorId: string): void {
    this._verificationStatus = 'VERIFIED';
    this.verifiedBy = verifiedByActorId;
    this.verifiedAt = new Date();
  }

  public reject(rejectedByActorId: string): void {
    this._verificationStatus = 'REJECTED';
    this.verifiedBy = rejectedByActorId;
    this.verifiedAt = new Date();
  }
}
