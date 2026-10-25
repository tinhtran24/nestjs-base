import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { AuthUser } from './auth-user.interface';

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const ROLES_KEY = 'auth:roles';
export const ALLOW_OWNER_KEY = 'auth:allowOwner';

/** Skip authentication for a route or a whole controller. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Require the current user to have at least one of the given roles. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Let any authenticated user through the role check; the service then limits the
 * query to rows the user owns (see CrudService.scope). Used together with @Roles:
 * users with one of the roles see everything, others only their own rows.
 */
export const AllowOwner = () => SetMetadata(ALLOW_OWNER_KEY, true);

/** Inject the authenticated user (or `undefined` on public routes). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined =>
    ctx.switchToHttp().getRequest().user,
);
