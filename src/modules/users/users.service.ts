import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Includeable, Transaction } from 'sequelize';
import { AuthUser, hasAnyRole } from '../../core/auth';
import { CrudContext, CrudService, SequelizeRepository } from '../../core/crud';
import { PasswordHasher } from '../../core/security/password-hasher';
import { Role } from '../roles/models/role.model';
import { RoleType } from '../roles/role-type.enum';
import { RolesService } from '../roles/roles.service';
import { ProfileDto } from './dto/profile.dto';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { Profile } from './models/profile.model';
import { User, USER_WITH_PASSWORD } from './models/user.model';

const ROLES_INCLUDE: Includeable = {
  model: Role,
  attributes: ['id', 'name'],
  through: { attributes: [] },
};

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

@Injectable()
export class UsersService extends CrudService<
  User,
  CreateUserDto,
  UpdateUserDto
> {
  constructor(
    @InjectModel(User) private readonly users: typeof User,
    @InjectModel(Profile) private readonly profiles: typeof Profile,
    private readonly roles: RolesService,
    private readonly passwords: PasswordHasher,
  ) {
    // A user "owns" their own row.
    super(new SequelizeRepository(users), { ownerField: 'id' });
  }

  // ---- CrudService hooks -------------------------------------------------

  protected readOptions() {
    return { include: [ROLES_INCLUDE, { model: Profile }] };
  }

  protected async beforeCreate(dto: CreateUserDto, ctx: CrudContext) {
    this.assertCanGrant(dto.roles, ctx.user);
    const { profile: _profile, roles: _roles, password, ...rest } = dto;
    return {
      ...rest,
      email: normalizeEmail(dto.email),
      password: await this.passwords.hash(password),
    };
  }

  protected async afterCreate(
    user: User,
    dto: CreateUserDto,
    ctx: CrudContext,
  ) {
    await this.profiles.create(
      { ...dto.profile, userId: user.id },
      { transaction: ctx.transaction },
    );
    await this.assignRoles(user, dto.roles ?? [RoleType.USER], ctx.transaction);
  }

  protected async beforeUpdate(
    user: User,
    dto: UpdateUserDto,
    ctx: CrudContext,
  ) {
    await this.assertCanManage(user, ctx);
    if (dto.roles) this.assertCanGrant(dto.roles, ctx.user);
    const { profile: _profile, roles: _roles, password, email, ...rest } = dto;
    return {
      ...rest,
      ...(email && { email: normalizeEmail(email) }),
      ...(password && { password: await this.passwords.hash(password) }),
    };
  }

  protected async afterUpdate(
    user: User,
    dto: UpdateUserDto,
    ctx: CrudContext,
  ) {
    if (dto.profile)
      await this.upsertProfile(user.id, dto.profile, ctx.transaction);
    if (dto.roles) await this.assignRoles(user, dto.roles, ctx.transaction);
  }

  protected async beforeRemove(user: User, ctx: CrudContext) {
    if (ctx.user?.id === user.id)
      throw new BadRequestException('You cannot delete your own account here');
    await this.assertCanManage(user, ctx);
  }

  // ---- queries used by the auth module -----------------------------------

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.users.scope(USER_WITH_PASSWORD).findOne({
      where: { email: normalizeEmail(email) },
    });
  }

  findByIdWithPassword(id: string): Promise<User | null> {
    return this.users.scope(USER_WITH_PASSWORD).findByPk(id);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOne({ where: { email: normalizeEmail(email) } });
  }

  /** Loads the principal for an access token; inactive users are rejected. */
  async findAuthUser(id: string): Promise<AuthUser | null> {
    const user = await this.users.findOne({
      where: { id, isActive: true },
      include: [ROLES_INCLUDE],
    });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      roles: user.roles.map((role) => role.name),
    };
  }

  async setPassword(userId: string, password: string): Promise<void> {
    await this.users.update(
      { password: await this.passwords.hash(password) },
      { where: { id: userId } },
    );
  }

  async markVerified(userId: string): Promise<void> {
    await this.users.update({ isVerified: true }, { where: { id: userId } });
  }

  async touchLastLogin(userId: string): Promise<void> {
    await this.users.update(
      { lastLoginAt: new Date() },
      { where: { id: userId } },
    );
  }

  // ---- internals ---------------------------------------------------------

  private async assignRoles(
    user: User,
    names: string[],
    transaction?: Transaction,
  ): Promise<void> {
    const roles = await this.roles.findByNames(names, transaction);
    await user.$set('roles', roles, { transaction });
  }

  private async upsertProfile(
    userId: string,
    profile: ProfileDto,
    transaction?: Transaction,
  ): Promise<void> {
    const existing = await this.profiles.findOne({
      where: { userId },
      transaction,
    });
    if (existing) await existing.update(profile, { transaction });
    else await this.profiles.create({ ...profile, userId }, { transaction });
  }

  /** Only a super admin may hand out the super admin role. */
  private assertCanGrant(roles: string[] | undefined, actor?: AuthUser) {
    if (
      roles?.includes(RoleType.SUPER_ADMIN) &&
      !hasAnyRole(actor, [RoleType.SUPER_ADMIN])
    )
      throw new ForbiddenException('Only a super admin can grant SUPER_ADMIN');
  }

  /** Admins cannot modify or delete a super admin account. */
  private async assertCanManage(target: User, ctx: CrudContext) {
    if (!ctx.user || ctx.user.id === target.id) return;
    if (hasAnyRole(ctx.user, [RoleType.SUPER_ADMIN])) return;
    const roles = await target.$get('roles', { transaction: ctx.transaction });
    if (roles.some((role) => role.name === RoleType.SUPER_ADMIN))
      throw new ForbiddenException(
        'Only a super admin can manage this account',
      );
  }
}
