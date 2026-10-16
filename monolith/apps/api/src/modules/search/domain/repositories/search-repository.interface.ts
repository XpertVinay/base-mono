import { SearchDocument } from '../entities/search-document.entity.js';

export interface ISearchRepository {
  index(document: SearchDocument): Promise<void>;
  search(query: string, type?: string, limit?: number): Promise<SearchDocument[]>;
}
