import { SearchDocument } from '../entities/search-document.entity.js';

export interface ListSearchDocumentsOptions {
  page?: number;
  limit?: number;
  type?: string;
  search?: string;
}

export interface ISearchRepository {
  findById(id: string): Promise<SearchDocument | null>;
  index(doc: SearchDocument): Promise<void>;
  search(query: string, type?: string): Promise<SearchDocument[]>;
  listAll(options?: ListSearchDocumentsOptions): Promise<{ documents: SearchDocument[]; total: number }>;
  remove(id: string): Promise<boolean>;
}
