import type { Role, User } from '../types';

export function dashboardPath(role: Role | undefined | null): string {
  return role === 'ADMIN' ? '/admin/dashboard' : '/user/entries';
}

export function roleHome(user: User | null | undefined): string {
  if (!user) return '/login';
  return dashboardPath(user.role);
}
