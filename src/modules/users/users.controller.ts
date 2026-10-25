import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../../core/auth';
import { Crud, CrudController, CrudRoute } from '../../core/crud';
import { ADMIN_ROLES } from '../roles/role-type.enum';
import { CreateUserDto, UpdateMeDto, UpdateUserDto } from './dto/user.dto';
import { User } from './models/user.model';
import { UsersService } from './users.service';

@Crud({
  model: User,
  dto: { create: CreateUserDto, update: UpdateUserDto },
  access: { roles: ADMIN_ROLES },
  routes: {
    // Admins read any user, everyone else only themselves.
    [CrudRoute.GetOne]: { roles: ADMIN_ROLES, owner: true },
  },
  query: {
    filterable: [
      'email',
      'firstName',
      'lastName',
      'isActive',
      'isVerified',
      'createdAt',
    ],
    sortable: ['lastLoginAt'],
  },
})
@ApiTags('Users')
@Controller('users')
export class UsersController implements CrudController {
  constructor(readonly service: UsersService) {}

  // Declared in the class body, so registered before the generated GET /:id.
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my account' })
  me(@CurrentUser() user: AuthUser) {
    return this.service.findOne(user.id);
  }

  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update my name and profile' })
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto) {
    return this.service.update(user.id, dto, { user });
  }
}
