import { Entity } from '../../shared/domain/entity.js';

export interface SearchDocumentProps {
  documentType: string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  createdAt?: Date;
}

export class SearchDocument extends Entity<SearchDocumentProps> {
  private constructor(props: SearchDocumentProps, id: string) {
    super(props, id);
  }

  public static create(id: string, props: SearchDocumentProps): SearchDocument {
    return new SearchDocument(
      {
        ...props,
        createdAt: props.createdAt || new Date()
      },
      id
    );
  }

  get documentType(): string { return this.props.documentType; }
  get title(): string { return this.props.title; }
  get description(): string | undefined { return this.props.description; }
  get metadata(): Record<string, any> | undefined { return this.props.metadata; }
  get createdAt(): Date { return this.props.createdAt!; }
}
