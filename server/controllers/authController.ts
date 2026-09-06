import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Role, UserStatus } from '@prisma/client';
import { z } from 'zod';
import { config } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { MAX_ADMINS } from '../utils/admins.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const setupSchema = z
  .object({
    name: z.string().min(1, 'Full name is required'),
    email: z.string().email(),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(1),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const signupSchema = z
  .object({
    name: z.string().min(1, 'Full name is required'),
    email: z.string().email(),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(1),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const profileSchema = z
  .object({
    name: z.string().min(1),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(6).optional(),
    confirmPassword: z.string().optional(),
  })
  .superRefine((d, ctx) => {
    if (d.newPassword || d.confirmPassword || d.currentPassword) {
      if (!d.currentPassword) {
        ctx.addIssue({ code: 'custom', message: 'Current password is required', path: ['currentPassword'] });
      }
      if (!d.newPassword || d.newPassword.length < 6) {
        ctx.addIssue({
          code: 'custom',
          message: 'New password must be at least 6 characters',
          path: ['newPassword'],
        });
      }
      if (d.newPassword !== d.confirmPassword) {
        ctx.addIssue({ code: 'custom', message: 'Passwords do not match', path: ['confirmPassword'] });
      }
    }
  });

function signToken(userId: string) {
  return jwt.sign({ userId }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

function setAuthCookie(res: Response, token: string) {
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function publicUser(user: {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

export async function setupStatus(_req: Request, res: Response, next: NextFunction) {
  try {
    const adminCount = await prisma.user.count({ where: { role: Role.ADMIN } });
    res.json({
      // First open must create an ADMIN before any user signup is allowed.
      setupRequired: adminCount === 0,
      adminCount,
      maxAdmins: MAX_ADMINS,
      canCreateAdmin: adminCount < MAX_ADMINS,
    });
  } catch (err) {
    next(err);
  }
}

/** First admin only — allowed until at least one ADMIN exists. */
export async function setup(req: Request, res: Response, next: NextFunction) {
  try {
    const adminCount = await prisma.user.count({ where: { role: Role.ADMIN } });
    if (adminCount > 0) {
      throw new AppError('Initial setup is already complete. Use login or signup instead.', 403);
    }

    const input = setupSchema.parse(req.body);
    const email = input.email.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(input.password, 12);

    const user = await prisma.user.create({
      data: {
        name: input.name.trim(),
        email,
        passwordHash,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });

    const token = signToken(user.id);
    setAuthCookie(res, token);

    res.status(201).json({
      message: 'Admin account created successfully.',
      user: publicUser(user),
    });
  } catch (err) {
    next(err);
  }
}

/** Public signup — always USER. Blocked until an ADMIN exists. */
export async function signup(req: Request, res: Response, next: NextFunction) {
  try {
    const adminCount = await prisma.user.count({ where: { role: Role.ADMIN } });
    if (adminCount === 0) {
      throw new AppError('Studio setup is required first. Create the admin account at /setup.', 403);
    }

    const input = signupSchema.parse(req.body);
    const email = input.email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new AppError('Email already in use', 409);

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await prisma.user.create({
      data: {
        name: input.name.trim(),
        email,
        passwordHash,
        role: Role.USER,
        status: UserStatus.ACTIVE,
      },
    });

    const token = signToken(user.id);
    setAuthCookie(res, token);

    res.status(201).json({
      message: 'Account created successfully.',
      user: publicUser(user),
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }
    if (user.status !== 'ACTIVE') {
      throw new AppError(
        'Your account has been deactivated. Please contact the administrator.',
        403
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new AppError('Invalid email or password', 401);
    }

    const token = signToken(user.id);
    setAuthCookie(res, token);

    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    res.json({ user: req.user });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const input = profileSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!existing) throw new AppError('User not found', 404);

    const data: { name: string; passwordHash?: string } = {
      name: input.name.trim(),
    };

    if (input.newPassword) {
      const ok = await bcrypt.compare(input.currentPassword || '', existing.passwordHash);
      if (!ok) throw new AppError('Current password is incorrect', 400);
      data.passwordHash = await bcrypt.hash(input.newPassword, 12);
    }

    const user = await prisma.user.update({
      where: { id: existing.id },
      data,
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    res.json({ message: 'Profile updated successfully.', user });
  } catch (err) {
    next(err);
  }
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie(config.cookieName, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
    path: '/',
  });
  res.json({ message: 'Logged out successfully.' });
}
