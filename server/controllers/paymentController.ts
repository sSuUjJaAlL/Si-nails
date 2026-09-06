import { NextFunction, Request, Response } from 'express';
import { PaymentType, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { decimalToNumber, parseDateOnly } from '../utils/format.js';

/** Admin payments list — same ServiceEntry rows employees create. */
export async function listPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const search = String(req.query.search || '').trim();
    const date = String(req.query.date || '').trim();
    const paymentType = String(req.query.paymentType || '').trim();
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));

    const where: Prisma.ServiceEntryWhereInput = {};

    if (search) {
      where.OR = [
        { clientName: { contains: search, mode: 'insensitive' } },
        { serviceType: { contains: search, mode: 'insensitive' } },
        { employee: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (date) {
      where.date = parseDateOnly(date);
    } else if (from || to) {
      where.date = {};
      if (from) where.date.gte = parseDateOnly(from);
      if (to) where.date.lte = parseDateOnly(to);
    }

    if (paymentType === 'CASH' || paymentType === 'ONLINE') {
      where.paymentType = paymentType as PaymentType;
    }

    const [total, rows, aggregates] = await Promise.all([
      prisma.serviceEntry.count({ where }),
      prisma.serviceEntry.findMany({
        where,
        include: {
          employee: { select: { id: true, name: true } },
        },
        orderBy: [{ date: 'desc' }, { time: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.serviceEntry.groupBy({
        by: ['paymentType'],
        where,
        _sum: { amount: true },
      }),
    ]);

    let cashRevenue = 0;
    let onlineRevenue = 0;
    for (const row of aggregates) {
      const sum = decimalToNumber(row._sum.amount || 0);
      if (row.paymentType === 'CASH') cashRevenue = sum;
      if (row.paymentType === 'ONLINE') onlineRevenue = sum;
    }

    res.json({
      data: rows.map((a) => ({
        id: a.id,
        date: a.date.toISOString().slice(0, 10),
        time: a.time,
        amount: decimalToNumber(a.amount),
        paymentType: a.paymentType,
        clientName: a.clientName,
        serviceType: a.serviceType,
        employeeId: a.employeeId,
        employeeName: a.employee.name,
      })),
      summary: {
        totalRevenue: cashRevenue + onlineRevenue,
        cashRevenue,
        onlineRevenue,
      },
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    next(err);
  }
}
