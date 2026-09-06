import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { addDays, startOfWeek, startOfMonth } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { prisma } from '../config/prisma.js';
import { AppError } from '../utils/errors.js';
import {
  TZ,
  decimalToNumber,
  parseDateOnly,
  startOfDayKathmandu,
} from '../utils/format.js';

async function revenueBetween(from: Date, to: Date) {
  const where: Prisma.AppointmentWhereInput = {
    date: { gte: from, lte: to },
  };
  const [all, byType, count] = await Promise.all([
    prisma.appointment.aggregate({ where, _sum: { amount: true } }),
    prisma.appointment.groupBy({ by: ['paymentType'], where, _sum: { amount: true } }),
    prisma.appointment.count({ where }),
  ]);

  let cashRevenue = 0;
  let onlineRevenue = 0;
  for (const row of byType) {
    const sum = decimalToNumber(row._sum.amount || 0);
    if (row.paymentType === 'CASH') cashRevenue = sum;
    if (row.paymentType === 'ONLINE') onlineRevenue = sum;
  }

  return {
    totalRevenue: decimalToNumber(all._sum.amount || 0),
    cashRevenue,
    onlineRevenue,
    appointments: count,
  };
}

export async function getSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const fromQ = String(req.query.from || '').trim();
    const toQ = String(req.query.to || '').trim();

    const today = startOfDayKathmandu();
    const nowInKtm = new Date(
      formatInTimeZone(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ssXXX")
    );
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const monthStart = startOfMonth(today);

    const rangeFrom = fromQ ? parseDateOnly(fromQ) : addDays(today, -29);
    const rangeTo = toQ ? parseDateOnly(toQ) : today;

    const [
      todayStats,
      weekStats,
      monthStats,
      allTime,
      clientCount,
      todayAppointments,
      recentAppointments,
      chartRows,
      popularServicesRaw,
      recentClients,
      employeeActivityRaw,
    ] = await Promise.all([
      revenueBetween(today, today),
      revenueBetween(weekStart, today),
      revenueBetween(monthStart, today),
      revenueBetween(parseDateOnly('2000-01-01'), today),
      prisma.client.count(),
      prisma.appointment.findMany({
        where: { date: today },
        include: {
          client: { select: { id: true, name: true } },
          service: { select: { id: true, name: true } },
        },
        orderBy: { time: 'asc' },
      }),
      prisma.appointment.findMany({
        take: 8,
        orderBy: [{ date: 'desc' }, { time: 'desc' }],
        include: {
          client: { select: { id: true, name: true } },
          service: { select: { id: true, name: true } },
        },
      }),
      prisma.appointment.findMany({
        where: { date: { gte: rangeFrom, lte: rangeTo } },
        select: { date: true, amount: true, paymentType: true },
        orderBy: { date: 'asc' },
      }),
      prisma.appointment.groupBy({
        by: ['serviceId'],
        _count: { serviceId: true },
        _sum: { amount: true },
        orderBy: { _count: { serviceId: 'desc' } },
        take: 5,
      }),
      prisma.client.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, phone: true, createdAt: true },
      }),
      prisma.appointment.groupBy({
        by: ['createdById'],
        where: { date: { gte: addDays(today, -13), lte: today } },
        _count: { createdById: true },
        _sum: { amount: true },
        orderBy: { _count: { createdById: 'desc' } },
        take: 5,
      }),
    ]);

    const serviceIds = popularServicesRaw.map((s) => s.serviceId);
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, name: true },
    });
    const serviceName = Object.fromEntries(services.map((s) => [s.id, s.name]));

    const staffIds = employeeActivityRaw.map((e) => e.createdById);
    const staff = await prisma.user.findMany({
      where: { id: { in: staffIds } },
      select: { id: true, name: true, role: true },
    });
    const staffName = Object.fromEntries(staff.map((s) => [s.id, s]));

    const chartMap = new Map<string, { date: string; revenue: number; cash: number; online: number }>();
    for (const row of chartRows) {
      const key = row.date.toISOString().slice(0, 10);
      const entry = chartMap.get(key) || { date: key, revenue: 0, cash: 0, online: 0 };
      const amount = decimalToNumber(row.amount);
      entry.revenue += amount;
      if (row.paymentType === 'CASH') entry.cash += amount;
      else entry.online += amount;
      chartMap.set(key, entry);
    }

    const rangeStats = await revenueBetween(rangeFrom, rangeTo);

    res.json({
      data: {
        today: {
          appointments: todayStats.appointments,
          revenue: todayStats.totalRevenue,
          cashRevenue: todayStats.cashRevenue,
          onlineRevenue: todayStats.onlineRevenue,
        },
        week: weekStats,
        month: monthStats,
        allTime: {
          ...allTime,
          clients: clientCount,
        },
        range: {
          from: rangeFrom.toISOString().slice(0, 10),
          to: rangeTo.toISOString().slice(0, 10),
          ...rangeStats,
        },
        todayAppointments: todayAppointments.map((a) => ({
          id: a.id,
          date: a.date.toISOString().slice(0, 10),
          time: a.time,
          amount: decimalToNumber(a.amount),
          paymentType: a.paymentType,
          client: a.client,
          service: a.service,
        })),
        recentAppointments: recentAppointments.map((a) => ({
          id: a.id,
          date: a.date.toISOString().slice(0, 10),
          time: a.time,
          amount: decimalToNumber(a.amount),
          paymentType: a.paymentType,
          client: a.client,
          service: a.service,
        })),
        popularServices: popularServicesRaw.map((s) => ({
          serviceId: s.serviceId,
          name: serviceName[s.serviceId] || 'Service',
          count: s._count.serviceId,
          revenue: decimalToNumber(s._sum.amount || 0),
        })),
        recentClients: recentClients.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          createdAt: c.createdAt,
        })),
        employeeActivity: employeeActivityRaw.map((e) => ({
          userId: e.createdById,
          name: staffName[e.createdById]?.name || 'Staff',
          role: staffName[e.createdById]?.role || 'USER',
          appointments: e._count.createdById,
          revenue: decimalToNumber(e._sum.amount || 0),
        })),
        chart: Array.from(chartMap.values()),
        generatedAt: nowInKtm.toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
}

function serializeActivityEntry(row: {
  id: string;
  date: Date;
  time: string;
  clientName: string;
  serviceType: string;
  amount: Prisma.Decimal | number;
  paymentType: 'CASH' | 'ONLINE';
  employeeId: string;
  createdAt: Date;
  updatedAt: Date;
  employee: { id: string; name: string };
}) {
  return {
    id: row.id,
    date: row.date.toISOString().slice(0, 10),
    time: row.time,
    clientName: row.clientName,
    serviceType: row.serviceType,
    amount: decimalToNumber(row.amount),
    paymentType: row.paymentType,
    employeeId: row.employeeId,
    employeeName: row.employee.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getActivity(req: Request, res: Response, next: NextFunction) {
  try {
    const dateQ = String(req.query.date || '').trim();
    const day = dateQ ? parseDateOnly(dateQ) : startOfDayKathmandu();
    const date = day.toISOString().slice(0, 10);

    const includeEmployee = {
      employee: { select: { id: true, name: true } },
    } as const;

    const [entries, recent] = await Promise.all([
      prisma.serviceEntry.findMany({
        where: { date: day },
        include: includeEmployee,
        orderBy: [{ time: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.serviceEntry.findMany({
        take: 25,
        include: includeEmployee,
        orderBy: [{ createdAt: 'desc' }],
      }),
    ]);

    let cashRevenue = 0;
    let onlineRevenue = 0;
    const clientNames = new Set<string>();

    for (const row of entries) {
      const amount = decimalToNumber(row.amount);
      clientNames.add(row.clientName.trim().toLowerCase());
      if (row.paymentType === 'CASH') cashRevenue += amount;
      else if (row.paymentType === 'ONLINE') onlineRevenue += amount;
    }

    res.json({
      data: {
        date,
        summary: {
          totalClients: clientNames.size,
          totalServices: entries.length,
          totalRevenue: cashRevenue + onlineRevenue,
          cashRevenue,
          onlineRevenue,
        },
        entries: entries.map(serializeActivityEntry),
        recent: recent.map(serializeActivityEntry),
      },
    });
  } catch (err) {
    next(err);
  }
}

/** Unique clients derived from employee ServiceEntry records (admin only). */
export async function getEntryClients(req: Request, res: Response, next: NextFunction) {
  try {
    const search = String(req.query.search || '').trim().toLowerCase();

    const rows = await prisma.serviceEntry.findMany({
      include: {
        employee: { select: { id: true, name: true } },
      },
      orderBy: [{ date: 'desc' }, { time: 'desc' }, { createdAt: 'desc' }],
    });

    type Agg = {
      id: string;
      name: string;
      visits: number;
      totalSpent: number;
      lastVisit: string;
      lastService: string;
      lastEmployee: string;
      lastPaymentType: 'CASH' | 'ONLINE';
    };

    const map = new Map<string, Agg>();

    for (const row of rows) {
      const key = row.clientName.trim().toLowerCase();
      if (search && !key.includes(search)) continue;
      const amount = decimalToNumber(row.amount);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          id: key,
          name: row.clientName.trim(),
          visits: 1,
          totalSpent: amount,
          lastVisit: row.date.toISOString().slice(0, 10),
          lastService: row.serviceType,
          lastEmployee: row.employee.name,
          lastPaymentType: row.paymentType,
        });
      } else {
        existing.visits += 1;
        existing.totalSpent += amount;
      }
    }

    const clients = Array.from(map.values()).sort((a, b) =>
      a.lastVisit < b.lastVisit ? 1 : a.lastVisit > b.lastVisit ? -1 : 0
    );

    res.json({ data: clients });
  } catch (err) {
    next(err);
  }
}

/**
 * Business reports from ServiceEntry (employee payments) + Appointment counts.
 * Admin only. Driven by from/to query dates.
 */
export async function getBusinessReport(req: Request, res: Response, next: NextFunction) {
  try {
    const today = startOfDayKathmandu();
    const fromQ = String(req.query.from || '').trim();
    const toQ = String(req.query.to || '').trim();
    const period = String(req.query.period || '').trim().toLowerCase();

    let from = fromQ ? parseDateOnly(fromQ) : addDays(today, -29);
    let to = toQ ? parseDateOnly(toQ) : today;

    if (period === 'today') {
      from = today;
      to = today;
    } else if (period === 'week') {
      from = startOfWeek(today, { weekStartsOn: 1 });
      to = today;
    } else if (period === 'month') {
      from = startOfMonth(today);
      to = today;
    }

    if (from > to) {
      throw new AppError('From date must be on or before To date', 400);
    }

    const entryWhere: Prisma.ServiceEntryWhereInput = {
      date: { gte: from, lte: to },
    };
    const apptWhere: Prisma.AppointmentWhereInput = {
      date: { gte: from, lte: to },
    };

    const [entries, appointmentCount] = await Promise.all([
      prisma.serviceEntry.findMany({
        where: entryWhere,
        select: {
          date: true,
          amount: true,
          paymentType: true,
          clientName: true,
          serviceType: true,
        },
        orderBy: { date: 'asc' },
      }),
      prisma.appointment.count({ where: apptWhere }),
    ]);

    let cashRevenue = 0;
    let onlineRevenue = 0;
    const clients = new Set<string>();
    const chartMap = new Map<string, { date: string; revenue: number; cash: number; online: number }>();
    const serviceMap = new Map<string, { name: string; bookings: number; revenue: number }>();

    for (const row of entries) {
      const amount = decimalToNumber(row.amount);
      clients.add(row.clientName.trim().toLowerCase());
      if (row.paymentType === 'CASH') cashRevenue += amount;
      else onlineRevenue += amount;

      const key = row.date.toISOString().slice(0, 10);
      const day = chartMap.get(key) || { date: key, revenue: 0, cash: 0, online: 0 };
      day.revenue += amount;
      if (row.paymentType === 'CASH') day.cash += amount;
      else day.online += amount;
      chartMap.set(key, day);

      const svcKey = row.serviceType.trim().toLowerCase();
      const svc = serviceMap.get(svcKey) || {
        name: row.serviceType.trim(),
        bookings: 0,
        revenue: 0,
      };
      svc.bookings += 1;
      svc.revenue += amount;
      serviceMap.set(svcKey, svc);
    }

    const servicePerformance = Array.from(serviceMap.values()).sort((a, b) => b.revenue - a.revenue);

    res.json({
      data: {
        range: {
          from: from.toISOString().slice(0, 10),
          to: to.toISOString().slice(0, 10),
          period: period || 'custom',
        },
        summary: {
          totalRevenue: cashRevenue + onlineRevenue,
          totalClients: clients.size,
          totalServices: entries.length,
          cashRevenue,
          onlineRevenue,
          totalAppointments: appointmentCount,
        },
        chart: Array.from(chartMap.values()),
        servicePerformance,
        generatedAt: formatInTimeZone(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ssXXX"),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getUserDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new AppError('Authentication required', 401);
    const today = startOfDayKathmandu();

    const [todayAppointments, personalCount, personalSum] = await Promise.all([
      prisma.appointment.findMany({
        where: { date: today },
        include: {
          client: { select: { id: true, name: true } },
          service: { select: { id: true, name: true } },
        },
        orderBy: { time: 'asc' },
      }),
      prisma.appointment.count({
        where: { date: today, createdById: req.user.id },
      }),
      prisma.appointment.aggregate({
        where: { date: today, createdById: req.user.id },
        _sum: { amount: true },
      }),
    ]);

    const serviceNames = new Set(todayAppointments.map((a) => a.service.name));

    res.json({
      data: {
        todayAppointments: todayAppointments.map((a) => ({
          id: a.id,
          date: a.date.toISOString().slice(0, 10),
          time: a.time,
          amount: decimalToNumber(a.amount),
          paymentType: a.paymentType,
          client: a.client,
          service: a.service,
        })),
        todayCount: todayAppointments.length,
        todayServices: serviceNames.size,
        personalTodayCount: personalCount,
        personalTodayRevenue: decimalToNumber(personalSum._sum.amount || 0),
      },
    });
  } catch (err) {
    next(err);
  }
}
