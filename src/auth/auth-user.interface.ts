import { RoleName } from '../roles/role-name.enum';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  roles: RoleName[];
}

export interface RequestWithUser {
  user: AuthUser;
}
