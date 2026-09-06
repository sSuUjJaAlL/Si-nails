import { PrismaClient, Role, UserStatus, PaymentType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const base = process.env.API_BASE || 'http://localhost:5000';

async function req(path, { method = 'GET', body, cookie } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(base + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.getSetCookie?.() || [];
  const nextCookie = set.map((c) => c.split(';')[0]).join('; ') || cookie;
  const json = await res.json().catch(() => null);
  return { status: res.status, json, cookie: nextCookie };
}

function assert(c, m) {
  if (!c) throw new Error(m);
}

async function main() {
  await prisma.serviceEntry.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.client.deleteMany();
  await prisma.service.deleteMany();
  await prisma.user.deleteMany();

  const hash = await bcrypt.hash('Test@123', 10);
  await prisma.user.create({
    data: {
      name: 'Admin',
      email: 'admin@test.com',
      passwordHash: hash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });
  const emp = await prisma.user.create({
    data: {
      name: 'Emp One',
      email: 'emp@test.com',
      passwordHash: hash,
      role: Role.USER,
      status: UserStatus.ACTIVE,
    },
  });

  let r = await req('/api/auth/login', {
    method: 'POST',
    body: { email: 'emp@test.com', password: 'Test@123' },
  });
  assert(r.status === 200, 'emp login');
  const empCookie = r.cookie;

  r = await req('/api/entries', {
    method: 'POST',
    cookie: empCookie,
    body: {
      date: '2026-09-06',
      time: '10:00',
      clientName: 'Pay Client',
      serviceType: 'Facial',
      amount: 1500,
      paymentType: PaymentType.CASH,
    },
  });
  assert(r.status === 201, 'entry create');

  r = await req('/api/entries', {
    method: 'POST',
    cookie: empCookie,
    body: {
      date: '2026-09-06',
      time: '11:00',
      clientName: 'Pay Client 2',
      serviceType: 'facial',
      amount: 2000,
      paymentType: PaymentType.ONLINE,
    },
  });
  assert(r.status === 201, 'entry 2');

  // USER denied admin APIs
  for (const path of [
    '/api/payments',
    '/api/reports/business?period=today',
    '/api/appointments',
    '/api/reports/activity?date=2026-09-06',
  ]) {
    r = await req(path, { cookie: empCookie });
    assert(r.status === 403, `user must be denied ${path}, got ${r.status}`);
  }

  r = await req('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@test.com', password: 'Test@123' },
  });
  assert(r.status === 200, 'admin login');
  const adminCookie = r.cookie;

  r = await req('/api/payments?from=2026-09-06&to=2026-09-06', { cookie: adminCookie });
  assert(r.status === 200, 'payments');
  assert(r.json.summary.totalRevenue === 3500, `pay total ${r.json.summary.totalRevenue}`);
  assert(r.json.summary.cashRevenue === 1500, 'cash');
  assert(r.json.summary.onlineRevenue === 2000, 'online');
  assert(r.json.data.some((p) => p.clientName === 'Pay Client' && p.employeeName === 'Emp One'), 'emp on payment');

  r = await req('/api/reports/business?from=2026-09-06&to=2026-09-06', { cookie: adminCookie });
  assert(r.status === 200, 'business report');
  assert(r.json.data.summary.totalRevenue === 3500, 'report revenue');
  assert(r.json.data.summary.totalServices === 2, 'services');
  assert(r.json.data.summary.totalClients === 2, 'clients');
  const facial = r.json.data.servicePerformance.find((s) => s.name.toLowerCase() === 'facial');
  assert(facial && facial.bookings === 2 && facial.revenue === 3500, 'facial grouped');

  r = await req('/api/appointments', {
    method: 'POST',
    cookie: adminCookie,
    body: {
      date: '2026-09-06',
      time: '15:00',
      newClient: { name: 'Appt Client' },
      serviceName: 'Nails',
      amount: 2500,
      paymentType: 'CASH',
      status: 'CONFIRMED',
    },
  });
  assert(r.status === 201, `appt create ${JSON.stringify(r.json)}`);
  assert(r.json.data.status === 'CONFIRMED', 'status');
  assert(r.json.data.service.name === 'Nails', 'service name');
  const apptId = r.json.data.id;

  r = await req('/api/appointments', { cookie: adminCookie });
  assert(r.status === 200 && r.json.data.length >= 1, 'list appts');
  assert(r.json.data.some((a) => a.id === apptId), 'appt visible');

  r = await req(`/api/appointments/${apptId}`, {
    method: 'PUT',
    cookie: adminCookie,
    body: {
      date: '2026-09-06',
      time: '15:00',
      clientId: r.json.data.find((a) => a.id === apptId).client.id,
      serviceName: 'Nails',
      amount: 2500,
      paymentType: 'CASH',
      status: 'COMPLETED',
    },
  });
  // re-fetch client id properly
  r = await req(`/api/appointments/${apptId}`, { cookie: adminCookie });
  const clientId = r.json.data.client.id;
  r = await req(`/api/appointments/${apptId}`, {
    method: 'PUT',
    cookie: adminCookie,
    body: {
      date: '2026-09-06',
      time: '15:00',
      clientId,
      serviceName: 'Nails',
      amount: 2500,
      paymentType: 'CASH',
      status: 'COMPLETED',
    },
  });
  assert(r.status === 200 && r.json.data.status === 'COMPLETED', 'status update');

  r = await req('/api/reports/business?from=2026-09-06&to=2026-09-06', { cookie: adminCookie });
  assert(r.json.data.summary.totalAppointments === 1, 'appt count in report');

  console.log('OK admin business: payments, reports, appointments + security');
}

main()
  .catch((e) => {
    console.error('FAIL', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
