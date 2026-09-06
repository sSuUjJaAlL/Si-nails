import { NextFunction, Request, Response } from 'express';
import { AppointmentStatus, PaymentType, Prisma, Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { decimalToNumber, parseDateOnly } from '../utils/format.js';
import { getParamId } from '../utils/params.js';

const appointmentSchema = z
  .object({
    date: z.string().min(1),
    time: z.string().min(1),
    clientId: z.string().min(1).optional(),
    newClient: z
      .object({
        name: z.string().min(1),
        phone: z.string().optional(),
      })
      .optional(),
    serviceId: z.string().min(1).optional(),
    serviceName: z.string().min(1).optional(),
    amount: z.coerce.number().positive(),
    paymentType: z.nativeEnum(PaymentType),
    status: z.nativeEnum(AppointmentStatus).optional(),
  })
  .refine((d) => Boolean(d.serviceId || d.serviceName?.trim()), {
    message: 'Service is required',
    path: ['serviceName'],
  });

const statusSchema = z.object({
  status: z.nativeEnum(AppointmentStatus),
});

function serializeAppointment(a: {
  id: string;
  date: Date;
  time: string;
  amount: Prisma.Decimal | number;
  paymentType: PaymentType;
  status: AppointmentStatus;
  createdAt: Date;
  updatedAt: Date;
  client: { id: string; name: string; phone: string | null };
  service: { id: string; name: string; defaultPrice: Prisma.Decimal | number };
  createdBy: { id: string; name: string };
}) {
  return {
    id: a.id,
    date: a.date.toISOString().slice(0, 10),
    time: a.time,
    amount: decimalToNumber(a.amount),
    paymentType: a.paymentType,
    status: a.status,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    client: a.client,
    service: {
      id: a.service.id,
      name: a.service.name,
      defaultPrice: decimalToNumber(a.service.defaultPrice),
    },
    createdBy: a.createdBy,
    employee: a.createdBy,
  };
}

const include = {
  client: { select: { id: true, name: true, phone: true } },
  service: { select: { id: true, name: true, defaultPrice: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

async function resolveClientId(input: z.infer<typeof appointmentSchema>, allowCreate: boolean) {
  if (input.clientId) {
    const client = await prisma.client.findUnique({ where: { id: input.clientId } });
    if (!client) throw new AppError('Client not found', 404);
    return client.id;
  }
  if (allowCreate && input.newClient?.name) {
    const created = await prisma.client.create({
      data: {
        name: input.newClient.name.trim(),
        phone: input.newClient.phone?.trim() || null,
      },
    });
    return created.id;
  }
  throw new AppError('Client is required', 400);
}

async function resolveServiceId(
  input: z.infer<typeof appointmentSchema>,
  amount: number
): Promise<string> {
  if (input.serviceId) {
    const service = await prisma.service.findUnique({ where: { id: input.serviceId } });
    if (!service) throw new AppError('Service not found', 400);
    return service.id;
  }

  const name = (input.serviceName || '').trim();
  if (!name) throw new AppError('Service is required', 400);

  const existing = await prisma.service.findFirst({
    where: { name: { equals: name, mode: 'insensitive' } },
  });
  if (existing) return existing.id;

  const created = await prisma.service.create({
    data: {
      name,
      defaultPrice: amount,
      active: true,
    },
  });
  return created.id;
}

export async function listAppointments(req: Request, res: Response, next: NextFunction) {
  try {
    const search = String(req.query.search || '').trim();
    const date = String(req.query.date || '').trim();
    const status = String(req.query.status || '').trim();
    const employeeId = String(req.query.employeeId || '').trim();
    const sort = String(req.query.sort || 'newest');
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));

    const where: Prisma.AppointmentWhereInput = {};

    if (search) {
      where.OR = [
        { client: { name: { contains: search, mode: 'insensitive' } } },
        { service: { name: { contains: search, mode: 'insensitive' } } },
        { createdBy: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }
    if (date) where.date = parseDateOnly(date);
    if (status && Object.values(AppointmentStatus).includes(status as AppointmentStatus)) {
      where.status = status as AppointmentStatus;
    }
    if (employeeId) where.createdById = employeeId;

    let orderBy: Prisma.AppointmentOrderByWithRelationInput[] = [
      { date: 'desc' },
      { time: 'desc' },
    ];
    if (sort === 'oldest') orderBy = [{ date: 'asc' }, { time: 'asc' }];
    if (sort === 'highest') orderBy = [{ amount: 'desc' }];
    if (sort === 'lowest') orderBy = [{ amount: 'asc' }];

    const [total, rows] = await Promise.all([
      prisma.appointment.count({ where }),
      prisma.appointment.findMany({
        where,
        include,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    res.json({
      data: rows.map(serializeAppointment),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) || 1 },
    });
  } catch (err) {
    next(err);
  }
}

export async function getAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getParamId(req);
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include,
    });
    if (!appointment) throw new AppError('Appointment not found', 404);
    res.json({ data: serializeAppointment(appointment) });
  } catch (err) {
    next(err);
  }
}

export async function createAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const input = appointmentSchema.parse(req.body);
    const clientId = await resolveClientId(input, true);
    const serviceId = await resolveServiceId(input, input.amount);

    const appointment = await prisma.appointment.create({
      data: {
        date: parseDateOnly(input.date),
        time: input.time,
        clientId,
        serviceId,
        amount: input.amount,
        paymentType: input.paymentType,
        status: input.status || AppointmentStatus.PENDING,
        createdById: req.user.id,
      },
      include,
    });

    res.status(201).json({
      message: 'Appointment added successfully.',
      data: serializeAppointment(appointment),
    });
  } catch (err) {
    next(err);
  }
}

export async function updateAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getParamId(req);
    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) throw new AppError('Appointment not found', 404);

    const input = appointmentSchema.parse(req.body);
    const clientId = await resolveClientId(input, true);
    const serviceId = await resolveServiceId(input, input.amount);

    const appointment = await prisma.appointment.update({
      where: { id },
      data: {
        date: parseDateOnly(input.date),
        time: input.time,
        clientId,
        serviceId,
        amount: input.amount,
        paymentType: input.paymentType,
        ...(input.status ? { status: input.status } : {}),
      },
      include,
    });

    res.json({
      message: 'Appointment updated successfully.',
      data: serializeAppointment(appointment),
    });
  } catch (err) {
    next(err);
  }
}

export async function updateAppointmentStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getParamId(req);
    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) throw new AppError('Appointment not found', 404);

    const { status } = statusSchema.parse(req.body);
    const appointment = await prisma.appointment.update({
      where: { id },
      data: { status },
      include,
    });

    res.json({
      message: 'Status updated successfully.',
      data: serializeAppointment(appointment),
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteAppointment(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getParamId(req);
    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) throw new AppError('Appointment not found', 404);

    await prisma.appointment.delete({ where: { id } });
    res.json({ message: 'Appointment deleted successfully.' });
  } catch (err) {
    next(err);
  }
}

/** Lightweight staff list for appointment filters (admin). */
export async function listAppointmentEmployees(_req: Request, res: Response, next: NextFunction) {
  try {
    const users = await prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });
    res.json({
      data: users.map((u) => ({
        id: u.id,
        name: u.name,
        role: u.role as Role,
      })),
    });
  } catch (err) {
    next(err);
  }
}
