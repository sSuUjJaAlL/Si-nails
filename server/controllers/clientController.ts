import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { decimalToNumber } from '../utils/format.js';
import { getParamId } from '../utils/params.js';

const clientSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional().nullable(),
});

export async function listClients(req: Request, res: Response, next: NextFunction) {
  try {
    const search = String(req.query.search || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    const where: Prisma.ClientWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const [total, clients] = await Promise.all([
      prisma.client.count({ where }),
      prisma.client.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          appointments: {
            orderBy: { date: 'desc' },
            select: { id: true, date: true, amount: true },
          },
        },
      }),
    ]);

    const data = clients.map((c) => {
      const visits = c.appointments.length;
      const totalSpent = c.appointments.reduce((sum, a) => sum + decimalToNumber(a.amount), 0);
      const lastVisit = c.appointments[0]?.date?.toISOString().slice(0, 10) || null;
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        visits,
        totalSpent,
        lastVisit,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    });

    res.json({ data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    next(err);
  }
}

export async function getClient(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getParamId(req);
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        appointments: {
          orderBy: [{ date: 'desc' }, { time: 'desc' }],
          include: {
            service: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!client) throw new AppError('Client not found', 404);

    const appointments = client.appointments.map((a) => ({
      id: a.id,
      date: a.date.toISOString().slice(0, 10),
      time: a.time,
      amount: decimalToNumber(a.amount),
      paymentType: a.paymentType,
      service: a.service,
    }));

    res.json({
      data: {
        id: client.id,
        name: client.name,
        phone: client.phone,
        visits: appointments.length,
        totalSpent: appointments.reduce((s, a) => s + a.amount, 0),
        appointments,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function createClient(req: Request, res: Response, next: NextFunction) {
  try {
    const input = clientSchema.parse(req.body);
    const client = await prisma.client.create({
      data: { name: input.name.trim(), phone: input.phone?.trim() || null },
    });
    res.status(201).json({ message: 'Client added successfully.', data: client });
  } catch (err) {
    next(err);
  }
}

export async function updateClient(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getParamId(req);
    const existing = await prisma.client.findUnique({ where: { id } });
    if (!existing) throw new AppError('Client not found', 404);

    const input = clientSchema.parse(req.body);
    const client = await prisma.client.update({
      where: { id },
      data: { name: input.name.trim(), phone: input.phone?.trim() || null },
    });
    res.json({ message: 'Client updated successfully.', data: client });
  } catch (err) {
    next(err);
  }
}

export async function deleteClient(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getParamId(req);
    const existing = await prisma.client.findUnique({
      where: { id },
      include: { _count: { select: { appointments: true } } },
    });
    if (!existing) throw new AppError('Client not found', 404);
    if (existing._count.appointments > 0) {
      throw new AppError('Cannot delete a client with appointment history.', 409);
    }
    await prisma.client.delete({ where: { id } });
    res.json({ message: 'Client deleted successfully.' });
  } catch (err) {
    next(err);
  }
}
