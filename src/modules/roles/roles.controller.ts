import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Crud, CrudController, CrudRoute } from '../../core/crud';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';
import { Role } from './models/role.model';
import { ADMIN_ROLES, RoleType } from './role-type.enum';
import { RolesService } from './roles.service';

const SUPER_ADMIN_ONLY = { roles: [RoleType.SUPER_ADMIN] };

@Crud({
  model: Role,
  dto: { create: CreateRoleDto, update: UpdateRoleDto },
  access: { roles: ADMIN_ROLES },
  routes: {
    [CrudRoute.CreateOne]: SUPER_ADMIN_ONLY,
    [CrudRoute.UpdateOne]: SUPER_ADMIN_ONLY,
    [CrudRoute.DeleteOne]: SUPER_ADMIN_ONLY,
  },
  query: { filterable: ['name'], defaultSort: ['name', 'ASC'] },
})
@ApiTags('Roles')
@Controller('roles')
export class RolesController implements CrudController {
  constructor(readonly service: RolesService) {}
}
