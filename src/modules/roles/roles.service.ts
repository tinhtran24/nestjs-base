import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Transaction } from 'sequelize';
import { CrudService, SequelizeRepository } from '../../core/crud';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { Role } from './models/role.model';
import { RoleType } from './role-type.enum';

@Injectable()
export class RolesService extends CrudService<
  Role,
  CreateRoleDto,
  UpdateRoleDto
> {
  constructor(@InjectModel(Role) model: typeof Role) {
    super(new SequelizeRepository(model));
  }

  // Built-in roles are referenced by code (registration, guards); keep them stable.
  protected async beforeUpdate(role: Role, dto: UpdateRoleDto) {
    if (dto.name && dto.name !== role.name) this.assertNotBuiltIn(role);
    return dto;
  }

  protected async beforeRemove(role: Role) {
    this.assertNotBuiltIn(role);
  }

  private assertNotBuiltIn(role: Role) {
    if (Object.values<string>(RoleType).includes(role.name))
      throw new BadRequestException(
        `Built-in role ${role.name} cannot be renamed or deleted`,
      );
  }

  /** Resolves role names to rows; fails when one of them does not exist. */
  async findByNames(
    names: string[],
    transaction?: Transaction,
  ): Promise<Role[]> {
    const unique = [...new Set(names)];
    const roles = await this.repository.findAll({
      where: { name: { [Op.in]: unique } },
      transaction,
    });
    const missing = unique.filter(
      (name) => !roles.some((r) => r.name === name),
    );
    if (missing.length)
      throw new BadRequestException(`Unknown role(s): ${missing.join(', ')}`);
    return roles;
  }
}
