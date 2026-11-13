import { v4 as uuidv4 } from 'uuid';
import { Permission } from '../../domain/entities/permission.entity.js';
import { IPermissionRepository } from '../../domain/repositories/permission-repository.interface.js';
import { AppError, NotFoundError } from '../../shared/presentation/error-handler.middleware.js';

export interface CreatePermissionDTO {
  name: string;
  category: string;
  description?: string;
}

export interface UpdatePermissionDTO {
  id: string;
  category?: string;
  description?: string | null;
}

export class ListPermissionsQuery {
  constructor(private readonly permRepo: IPermissionRepository) {}

  async execute(category?: string): Promise<Permission[]> {
    return this.permRepo.list(category);
  }
}

export class ListPermissionCategoriesQuery {
  constructor(private readonly permRepo: IPermissionRepository) {}

  async execute(): Promise<string[]> {
    return this.permRepo.listCategories();
  }
}

export class GetPermissionByIdQuery {
  constructor(private readonly permRepo: IPermissionRepository) {}

  async execute(idOrName: string): Promise<Permission> {
    let perm = await this.permRepo.findById(idOrName);
    if (!perm) {
      perm = await this.permRepo.findByName(idOrName);
    }
    if (!perm) {
      throw new NotFoundError(`Permission '${idOrName}'`);
    }
    return perm;
  }
}

export class CreatePermissionUseCase {
  constructor(private readonly permRepo: IPermissionRepository) {}

  async execute(dto: CreatePermissionDTO): Promise<Permission> {
    const name = dto.name.trim().toLowerCase();
    const category = dto.category.trim().toLowerCase();

    const exists = await this.permRepo.existsByName(name);
    if (exists) {
      throw new AppError(`Permission '${name}' already exists`, 409, 'PERMISSION_ALREADY_EXISTS');
    }

    const permission = new Permission({
      id: `perm_${uuidv4().replace(/-/g, '').slice(0, 16)}`,
      name,
      category,
      description: dto.description,
      isSystem: false
    });

    return this.permRepo.create(permission);
  }
}

export class UpdatePermissionUseCase {
  constructor(private readonly permRepo: IPermissionRepository) {}

  async execute(dto: UpdatePermissionDTO): Promise<Permission> {
    const perm = await this.permRepo.findById(dto.id);
    if (!perm) {
      throw new NotFoundError(`Permission '${dto.id}'`);
    }

    if (dto.category) {
      perm.updateCategory(dto.category);
    }
    if (dto.description !== undefined) {
      perm.updateDescription(dto.description);
    }

    return this.permRepo.update(perm);
  }
}

export class DeletePermissionUseCase {
  constructor(private readonly permRepo: IPermissionRepository) {}

  async execute(id: string): Promise<boolean> {
    const perm = await this.permRepo.findById(id);
    if (!perm) {
      throw new NotFoundError(`Permission '${id}'`);
    }

    if (perm.isSystem) {
      throw new AppError('Cannot delete built-in system permissions', 403, 'CANNOT_DELETE_SYSTEM_PERMISSION');
    }

    return this.permRepo.delete(id);
  }
}

