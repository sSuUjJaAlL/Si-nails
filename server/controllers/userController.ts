import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Role, UserStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { getParamId } from '../utils/params.js';
import { MAX_ADMINS, countAdmins } from '../utils/admins.js';

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  confirmPassword: z.string().optional(),
  status: z.nativeEnum(UserStatus).optional(),
  /** Only honored when creating an admin and under the max-admin limit. */
  role: z.enum(['ADMIN', 'USER']).optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  role: z.enum(['ADMIN', 'USER']).optional(),
});

const publicSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listUsers(_req: Request, res: Response, next: NextFunction) {
  try {
    const users = await prisma.user.findMany({
      select: publicSelect,
      orderBy: { createdAt: 'desc' },
    });
    const adminCount = await countAdmins();
    res.json({
      data: users,
      meta: { adminCount, maxAdmins: MAX_ADMINS, canCreateAdmin: adminCount < MAX_ADMINS },
    });
  } catch (err) {
    next(err);
  }
}

export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createUserSchema.parse(req.body);
    if (input.confirmPassword !== undefined && input.confirmPassword !== input.password) {
      throw new AppError('Passwords do not match', 400);
    }

    const requestedRole = input.role === 'ADMIN' ? Role.ADMIN : Role.USER;

    if (requestedRole === Role.ADMIN) {
      const adminCount = await countAdmins();
      if (adminCount >= MAX_ADMINS) {
        throw new AppError(
          `Maximum of ${MAX_ADMINS} administrator accounts allowed. Cannot create another admin.`,
          409
        );
      }
    }

    const email = input.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError('Email already in use', 409);

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: {
        name: input.name.trim(),
        email,
        passwordHash,
        role: requestedRole,
        status: input.status ?? UserStatus.ACTIVE,
      },
      select: publicSelect,
    });

    res.status(201).json({
      message:
        requestedRole === Role.ADMIN
          ? 'Admin account created successfully.'
          : 'User account created successfully.',
      data: user,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getParamId(req);
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new AppError('User not found', 404);

    const input = updateUserSchema.parse(req.body);
    const email = input.email.toLowerCase().trim();

    const clash = await prisma.user.findFirst({
      where: { email, NOT: { id } },
    });
    if (clash) throw new AppError('Email already in use', 409);

    const nextStatus = input.status ?? existing.status;
    let nextRole = existing.role;

    if (input.role === 'ADMIN' || input.role === 'USER') {
      nextRole = input.role === 'ADMIN' ? Role.ADMIN : Role.USER;
    }

    if (existing.role !== Role.ADMIN && nextRole === Role.ADMIN) {
      const adminCount = await countAdmins();
      if (adminCount >= MAX_ADMINS) {
        throw new AppError(
          `Maximum of ${MAX_ADMINS} administrator accounts allowed.`,
          409
        );
      }
    }

    if (existing.role === Role.ADMIN && (nextRole !== Role.ADMIN || nextStatus !== UserStatus.ACTIVE)) {
      const activeAdmins = await prisma.user.count({
        where: { role: Role.ADMIN, status: UserStatus.ACTIVE, NOT: { id: existing.id } },
      });
      if (activeAdmins === 0) {
        throw new AppError('You cannot remove or deactivate the only active administrator.', 409);
      }
    }

    const data: {
      name: string;
      email: string;
      status: UserStatus;
      role: Role;
      passwordHash?: string;
    } = {
      name: input.name.trim(),
      email,
      status: nextStatus,
      role: nextRole,
    };

    if (input.password) {
      data.passwordHash = await bcrypt.hash(input.password, 12);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: publicSelect,
    });

    res.json({ message: 'User updated successfully.', data: user });
  } catch (err) {
    next(err);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getParamId(req);
    const existing = await prisma.user.findUnique({
      where: { id },
      include: { _count: { select: { appointments: true } } },
    });
    if (!existing) throw new AppError('User not found', 404);

    if (req.user?.id === existing.id) {
      throw new AppError('You cannot delete your own account.', 409);
    }

    if (existing.role === Role.ADMIN) {
      const adminCount = await prisma.user.count({ where: { role: Role.ADMIN } });
      if (adminCount <= 1) {
        throw new AppError('You cannot delete the only administrator account.', 409);
      }
    }

    if (existing._count.appointments > 0) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { status: UserStatus.INACTIVE },
      });
      return res.json({
        message: 'User has appointment history, so the account was deactivated instead.',
      });
    }

    await prisma.user.delete({ where: { id: existing.id } });
    res.json({ message: 'User deleted successfully.' });
  } catch (err) {
    next(err);
  }
}
