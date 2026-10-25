/** Built-in roles. Add more by seeding rows in `Roles` and extending this enum. */
export enum RoleType {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export const ADMIN_ROLES = [RoleType.SUPER_ADMIN, RoleType.ADMIN];
