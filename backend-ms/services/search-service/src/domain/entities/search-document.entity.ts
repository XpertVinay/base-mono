import { Entity } from '../../shared/domain/entity.js';

export interface SearchDocumentProps {
  documentType: string;
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  createdAt?: Date;
  tenantId?: string;
}

export class SearchDocument extends Entity<SearchDocumentProps> {
  private constructor(props: SearchDocumentProps, id: string) {
    super(props, id);
  }

  public static create(id: string, props: SearchDocumentProps): SearchDocument {
    return new SearchDocument(
      {
        ...props,
        tenantId: props.tenantId || 'default',
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
  get tenantId(): string { return this.props.tenantId || 'default'; }

  public update(props: {
    documentType?: string;
    title?: string;
    description?: string;
    metadata?: Record<string, any>;
    tenantId?: string;
  }): void {
    if (props.documentType !== undefined) this.props.documentType = props.documentType;
    if (props.title !== undefined) this.props.title = props.title;
    if (props.description !== undefined) this.props.description = props.description;
    if (props.metadata !== undefined) this.props.metadata = props.metadata;
    if (props.tenantId !== undefined) this.props.tenantId = props.tenantId;
  }
}
