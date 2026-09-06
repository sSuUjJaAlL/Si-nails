import { NextFunction, Request, Response } from 'express';
import { PaymentType, Prisma, Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { decimalToNumber, parseDateOnly } from '../utils/format.js';
import { getParamId } from '../utils/params.js';

const entrySchema = z.object({
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
  clientName: z.string().min(1, 'Client name is required'),
  serviceType: z.string().min(1, 'Service type is required'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  paymentType: z.nativeEnum(PaymentType),
});

function serialize(entry: {
  id: string;
  date: Date;
  time: string;
  clientName: string;
  serviceType: string;
  amount: Prisma.Decimal | number;
  paymentType: PaymentType;
  employeeId: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: entry.id,
    date: entry.date.toISOString().slice(0, 10),
    time: entry.time,
    clientName: entry.clientName,
    serviceType: entry.serviceType,
    amount: decimalToNumber(entry.amount),
    paymentType: entry.paymentType,
    employeeId: entry.employeeId,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

function assertCanAccess(req: Request, employeeId: string) {
  if (!req.user) throw new AppError('Authentication required', 401);
  if (req.user.role === Role.ADMIN) return;
  if (req.user.id !== employeeId) {
    throw new AppError('You can only manage your own entries.', 403);
  }
}

export async function listEntries(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);

    const where: Prisma.ServiceEntryWhereInput =
      req.user.role === Role.ADMIN ? {} : { employeeId: req.user.id };

    const rows = await prisma.serviceEntry.findMany({
      where,
      orderBy: [{ date: 'desc' }, { time: 'desc' }, { createdAt: 'desc' }],
    });

    res.json({ data: rows.map(serialize) });
  } catch (err) {
    next(err);
  }
}

export async function createEntry(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const input = entrySchema.parse(req.body);

    const entry = await prisma.serviceEntry.create({
      data: {
        date: parseDateOnly(input.date),
        time: input.time,
        clientName: input.clientName.trim(),
        serviceType: input.serviceType.trim(),
        amount: input.amount,
        paymentType: input.paymentType,
        employeeId: req.user.id,
      },
    });

    res.status(201).json({
      message: 'Entry added successfully.',
      data: serialize(entry),
    });
  } catch (err) {
    next(err);
  }
}

export async function updateEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getParamId(req);
    const existing = await prisma.serviceEntry.findUnique({ where: { id } });
    if (!existing) throw new AppError('Entry not found', 404);
    assertCanAccess(req, existing.employeeId);

    const input = entrySchema.parse(req.body);
    const entry = await prisma.serviceEntry.update({
      where: { id },
      data: {
        date: parseDateOnly(input.date),
        time: input.time,
        clientName: input.clientName.trim(),
        serviceType: input.serviceType.trim(),
        amount: input.amount,
        paymentType: input.paymentType,
      },
    });

    res.json({
      message: 'Entry updated successfully.',
      data: serialize(entry),
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteEntry(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getParamId(req);
    const existing = await prisma.serviceEntry.findUnique({ where: { id } });
    if (!existing) throw new AppError('Entry not found', 404);
    assertCanAccess(req, existing.employeeId);

    await prisma.serviceEntry.delete({ where: { id } });
    res.json({ message: 'Entry deleted successfully.' });
  } catch (err) {
    next(err);
  }
}
