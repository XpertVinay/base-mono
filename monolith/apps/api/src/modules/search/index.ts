export { SearchModule, type ISearchModulePublicApi } from './search.module.js';
export { SearchDocument, type SearchDocumentProps } from './domain/entities/search-document.entity.js';
export { type ISearchRepository } from './domain/repositories/search-repository.interface.js';
export { PostgresSearchRepository } from './infrastructure/persistence/postgres-search.repository.js';
export {
  IndexDocumentUseCase,
  SearchQueryUseCase,
  GetSearchDocumentByIdQuery,
  DeleteSearchDocumentUseCase
} from './application/use-cases/search.use-cases.js';
export { SearchController } from './presentation/http/search.controller.js';
export { createSearchRouter } from './presentation/http/search.routes.js';
