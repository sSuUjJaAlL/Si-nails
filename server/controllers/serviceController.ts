import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import { decimalToNumber } from '../utils/format.js';
import { getParamId } from '../utils/params.js';

const serviceSchema = z.object({
  name: z.string().min(1),
  defaultPrice: z.coerce.number().positive(),
  active: z.boolean().optional(),
});

function serialize(s: { id: string; name: string; defaultPrice: { toString(): string }; active: boolean; createdAt: Date; updatedAt: Date }) {
  return {
    id: s.id,
    name: s.name,
    defaultPrice: decimalToNumber(s.defaultPrice),
    active: s.active,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

export async function listServices(req: Request, res: Response, next: NextFunction) {
  try {
    const activeOnly = String(req.query.activeOnly || '') === 'true';
    const services = await prisma.service.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: { name: 'asc' },
    });
    res.json({ data: services.map(serialize) });
  } catch (err) {
    next(err);
  }
}

export async function createService(req: Request, res: Response, next: NextFunction) {
  try {
    const input = serviceSchema.parse(req.body);
    const existing = await prisma.service.findUnique({ where: { name: input.name.trim() } });
    if (existing) throw new AppError('A service with this name already exists', 409);

    const service = await prisma.service.create({
      data: {
        name: input.name.trim(),
        defaultPrice: input.defaultPrice,
        active: input.active ?? true,
      },
    });
    res.status(201).json({ message: 'Service created successfully.', data: serialize(service) });
  } catch (err) {
    next(err);
  }
}

export async function updateService(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getParamId(req);
    const existing = await prisma.service.findUnique({ where: { id } });
    if (!existing) throw new AppError('Service not found', 404);

    const input = serviceSchema.parse(req.body);
    const clash = await prisma.service.findFirst({
      where: { name: input.name.trim(), NOT: { id } },
    });
    if (clash) throw new AppError('A service with this name already exists', 409);

    const service = await prisma.service.update({
      where: { id },
      data: {
        name: input.name.trim(),
        defaultPrice: input.defaultPrice,
        active: input.active ?? existing.active,
      },
    });
    res.json({ message: 'Service updated successfully.', data: serialize(service) });
  } catch (err) {
    next(err);
  }
}

export async function deleteService(req: Request, res: Response, next: NextFunction) {
  try {
    const id = getParamId(req);
    const existing = await prisma.service.findUnique({
      where: { id },
      include: { _count: { select: { appointments: true } } },
    });
    if (!existing) throw new AppError('Service not found', 404);
    if (existing._count.appointments > 0) {
      const service = await prisma.service.update({
        where: { id },
        data: { active: false },
      });
      return res.json({
        message: 'Service has appointments, so it was deactivated instead of deleted.',
        data: serialize(service),
      });
    }
    await prisma.service.delete({ where: { id } });
    res.json({ message: 'Service deleted successfully.' });
  } catch (err) {
    next(err);
  }
}
