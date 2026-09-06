import { Role } from '@prisma/client';
import { prisma } from '../config/prisma.js';

export const MAX_ADMINS = 2;

export async function countAdmins() {
  return prisma.user.count({ where: { role: Role.ADMIN } });
}
