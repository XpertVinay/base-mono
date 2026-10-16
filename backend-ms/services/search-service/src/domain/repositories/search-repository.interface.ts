import { SearchDocument } from '../entities/search-document.entity.js';

export interface ISearchRepository {
  index(doc: SearchDocument): Promise<void>;
  search(query: string, type?: string): Promise<SearchDocument[]>;
  remove(id: string): Promise<boolean>;
}
