import { NextFunction, Request, Response } from 'express';
import { ExpenseCategory, Prisma, Role, UserStatus } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { decimalToNumber, parseDateOnly } from '../utils/format.js';
import { getParamId } from '../utils/params.js';

const categoryEnum = z.nativeEnum(ExpenseCategory);

const createSchema = z.object({
  description: z.string().min(1, 'Expense description is required'),
  category: categoryEnum,
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  date: z.string().min(1, 'Date is required'),
  /** Admin only — ignored for USER (forced to self). */
  userId: z.string().min(1).optional(),
});

const updateSchema = z.object({
  description: z.string().min(1, 'Expense description is required'),
  category: categoryEnum,
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  date: z.string().min(1, 'Date is required'),
});

type ExpenseRow = {
  id: string;
  userId: string;
  description: string;
  category: ExpenseCategory;
  amount: Prisma.Decimal | number;
  date: Date;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  user: { id: string; name: string; role: Role };
  createdBy: { id: string; name: string; role: Role };
};

function serialize(row: ExpenseRow) {
  return {
    id: row.id,
    userId: row.userId,
    userName: row.user.name,
    description: row.description,
    category: row.category,
    amount: decimalToNumber(row.amount),
    date: row.date.toISOString().slice(0, 10),
    createdById: row.createdById,
    createdByName: row.createdBy.name,
    createdByRole: row.createdBy.role,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const include = {
  user: { select: { id: true, name: true, role: true } },
  createdBy: { select: { id: true, name: true, role: true } },
} as const;

async function assertOwnerIsUserAccount(userId: string) {
  const owner = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, status: true, name: true },
  });
  if (!owner) throw new AppError('Selected user not found', 404);
  if (owner.role !== Role.USER) {
    throw new AppError('Expenses can only belong to USER accounts, not admins.', 400);
  }
  if (owner.status !== UserStatus.ACTIVE) {
    throw new AppError('Selected user account is inactive.', 400);
  }
  return owner;
}

function assertCanManageExpense(req: Request, expenseUserId: string) {
  if (!req.user) throw new AppError('Authentication required', 401);
  if (req.user.role === Role.ADMIN) return;
  if (req.user.id !== expenseUserId) {
    throw new AppError('You can only manage your own expenses.', 403);
  }
}

export async function listExpenses(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);

    const filterUserId = String(req.query.userId || '').trim();
    let where: Prisma.ExpenseWhereInput;

    if (req.user.role === Role.ADMIN) {
      // Only expenses owned by USER accounts (never admin personal accounts)
      where = { user: { role: Role.USER } };
      if (filterUserId) {
        await assertOwnerIsUserAccount(filterUserId);
        where.userId = filterUserId;
      }
    } else {
      // USER: always own expenses only — ignore any client-supplied userId
      where = { userId: req.user.id };
    }

    const [rows, aggregate] = await Promise.all([
      prisma.expense.findMany({
        where,
        include,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.expense.aggregate({
        where,
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    res.json({
      data: rows.map(serialize),
      summary: {
        totalExpenses: decimalToNumber(aggregate._sum.amount || 0),
        count: aggregate._count.id,
        userId: req.user.role === Role.USER ? req.user.id : filterUserId || null,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function createExpense(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const input = createSchema.parse(req.body);

    let ownerId: string;

    if (req.user.role === Role.ADMIN) {
      if (!input.userId?.trim()) {
        throw new AppError('Select a user account for this expense.', 400);
      }
      await assertOwnerIsUserAccount(input.userId.trim());
      ownerId = input.userId.trim();
    } else {
      // Force ownership to authenticated USER — ignore body.userId
      ownerId = req.user.id;
    }

    const expense = await prisma.expense.create({
      data: {
        userId: ownerId,
        description: input.description.trim(),
        category: input.category,
        amount: input.amount,
        date: parseDateOnly(input.date),
        createdById: req.user.id,
      },
      include,
    });

    res.status(201).json({
      message: 'Expense added successfully.',
      data: serialize(expense),
    });
  } catch (err) {
    next(err);
  }
}

export async function updateExpense(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const id = getParamId(req);
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) throw new AppError('Expense not found', 404);

    assertCanManageExpense(req, existing.userId);

    // Admin may only manage USER-owned expenses
    if (req.user.role === Role.ADMIN) {
      await assertOwnerIsUserAccount(existing.userId);
    }

    const input = updateSchema.parse(req.body);
    const expense = await prisma.expense.update({
      where: { id },
      data: {
        description: input.description.trim(),
        category: input.category,
        amount: input.amount,
        date: parseDateOnly(input.date),
      },
      include,
    });

    res.json({
      message: 'Expense updated successfully.',
      data: serialize(expense),
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteExpense(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const id = getParamId(req);
    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) throw new AppError('Expense not found', 404);

    assertCanManageExpense(req, existing.userId);
    if (req.user.role === Role.ADMIN) {
      await assertOwnerIsUserAccount(existing.userId);
    }

    await prisma.expense.delete({ where: { id } });
    res.json({ message: 'Expense deleted successfully.' });
  } catch (err) {
    next(err);
  }
}

/** Active USER accounts for admin expense assignment/filter. */
export async function listExpenseUsers(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    if (req.user.role !== Role.ADMIN) {
      throw new AppError('Admin access required', 403);
    }

    const users = await prisma.user.findMany({
      where: { role: Role.USER, status: UserStatus.ACTIVE },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });

    res.json({ data: users });
  } catch (err) {
    next(err);
  }
}
