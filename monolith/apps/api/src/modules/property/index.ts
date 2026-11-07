export { PropertyModule, type IPropertyModulePublicApi } from './property.module.js';
export {
  Property,
  InvalidOwnershipSplitError,
  InvalidPropertyTransitionError
} from './domain/entities/property.entity.js';
export {
  PropertyUnit,
  InvalidUnitTransitionError
} from './domain/entities/unit.entity.js';
export { OwnershipSplit } from './domain/entities/ownership-split.entity.js';
export { type IPropertyRepository } from './domain/repositories/property-repository.interface.js';
export { PostgresPropertyRepository } from './infrastructure/persistence/postgres-property.repository.js';
export {
  CreatePropertyUseCase,
  type CreatePropertyInput
} from './application/commands/create-property.use-case.js';
export {
  UpdatePropertyStatusUseCase,
  type UpdatePropertyStatusInput
} from './application/commands/update-property-status.use-case.js';
export {
  ListPropertiesQuery,
  type ListPropertiesInput
} from './application/queries/list-properties.query.js';
export {
  GetPropertyDetailsQuery,
  type GetPropertyDetailsInput
} from './application/queries/get-property-details.query.js';
export {
  CreatePropertyUnitUseCase,
  type CreateUnitInput,
  ListPropertyUnitsQuery,
  UpdateUnitStatusUseCase,
  SetOwnershipSplitsUseCase,
  GetOwnershipSplitsQuery
} from './application/commands/property-units.use-cases.js';
export { PropertyController } from './presentation/http/property.controller.js';
export { createPropertyRouter } from './presentation/http/property.routes.js';
