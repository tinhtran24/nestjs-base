/** The authenticated principal attached to `request.user` by the JWT guard. */
export interface AuthUser {
  id: string;
  email: string;
  roles: string[];
}

export const hasAnyRole = (user: AuthUser | undefined, roles: string[]) =>
  !!user && roles.some((role) => user.roles.includes(role));
