import { Entity } from '../../../../shared/domain/entity.js';
import { v4 as uuidv4 } from 'uuid';

export interface SearchDocumentProps {
  documentType: string;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export class SearchDocument extends Entity<SearchDocumentProps> {
  private constructor(id: string, props: SearchDocumentProps) {
    super(id, props);
  }

  get documentType(): string { return this.props.documentType; }
  get title(): string { return this.props.title; }
  get description(): string | undefined { return this.props.description; }
  get metadata(): Record<string, unknown> | undefined { return this.props.metadata; }
  get createdAt(): Date { return this.props.createdAt; }

  public static create(documentType: string, title: string, description?: string, metadata?: Record<string, unknown>, id?: string): SearchDocument {
    return new SearchDocument(id || uuidv4(), {
      documentType,
      title,
      description,
      metadata,
      createdAt: new Date()
    });
  }

  public static reconstitute(id: string, props: SearchDocumentProps): SearchDocument {
    return new SearchDocument(id, props);
  }
}
