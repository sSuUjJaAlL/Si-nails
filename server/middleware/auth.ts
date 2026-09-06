import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { config } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: string;
};

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

type JwtPayload = { userId: string };

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  try {
    const token =
      req.cookies?.[config.cookieName] ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7)
        : undefined);

    if (!token) {
      throw new AppError('Authentication required', 401);
    }

    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    if (!user) {
      throw new AppError('Authentication required', 401);
    }

    if (user.status !== 'ACTIVE') {
      throw new AppError(
        'Your account has been deactivated. Please contact the administrator.',
        403
      );
    }

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    return next(new AppError('Invalid or expired session', 401));
  }
}

export function adminMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }
  if (req.user.role !== Role.ADMIN) {
    return next(new AppError('Admin access required', 403));
  }
  next();
}

/** Authenticated USER (or ADMIN for shared helpers). */
export function userMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }
  if (req.user.role !== Role.USER && req.user.role !== Role.ADMIN) {
    return next(new AppError('Access denied', 403));
  }
  next();
}
