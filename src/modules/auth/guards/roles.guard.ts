import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ALLOW_OWNER_KEY,
  AuthUser,
  hasAnyRole,
  IS_PUBLIC_KEY,
  ROLES_KEY,
} from '../../../core/auth';

/** Global guard enforcing @Roles(). Runs after JwtAuthGuard. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets))
      return true;

    const roles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      targets,
    );
    if (!roles?.length) return true;

    // Owner routes: the service narrows the query to the user's own rows.
    if (this.reflector.getAllAndOverride<boolean>(ALLOW_OWNER_KEY, targets))
      return true;

    const user: AuthUser = context.switchToHttp().getRequest().user;
    if (hasAnyRole(user, roles)) return true;
    throw new ForbiddenException('You do not have permission for this action');
  }
}
