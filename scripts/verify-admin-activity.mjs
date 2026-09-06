import { PrismaClient, Role, UserStatus } from '@prisma/client';
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
  await prisma.user.deleteMany();

  const hash = await bcrypt.hash('Test@123', 10);
  const admin = await prisma.user.create({
    data: {
      name: 'Admin One',
      email: 'admin@test.com',
      passwordHash: hash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });
  const emp1 = await prisma.user.create({
    data: {
      name: 'Employee 1',
      email: 'emp1@test.com',
      passwordHash: hash,
      role: Role.USER,
      status: UserStatus.ACTIVE,
    },
  });
  const emp2 = await prisma.user.create({
    data: {
      name: 'Employee 2',
      email: 'emp2@test.com',
      passwordHash: hash,
      role: Role.USER,
      status: UserStatus.ACTIVE,
    },
  });

  let r = await req('/api/auth/login', {
    method: 'POST',
    body: { email: 'emp1@test.com', password: 'Test@123' },
  });
  assert(r.status === 200, 'login emp1 failed');
  const cookie1 = r.cookie;

  r = await req('/api/entries', {
    method: 'POST',
    cookie: cookie1,
    body: {
      date: '2026-09-06',
      time: '10:30',
      clientName: 'Test Client',
      serviceType: 'Facial',
      amount: 1500,
      paymentType: 'CASH',
    },
  });
  assert(r.status === 201, `emp1 cash create: ${r.status} ${JSON.stringify(r.json)}`);
  assert(r.json.data.employeeId === emp1.id, 'employeeId must come from session');

  r = await req('/api/entries', {
    method: 'POST',
    cookie: cookie1,
    body: {
      date: '2026-09-06',
      time: '12:00',
      clientName: 'Maya Rai',
      serviceType: 'Nails',
      amount: 2500,
      paymentType: 'ONLINE',
    },
  });
  assert(r.status === 201, 'emp1 online create failed');

  r = await req('/api/auth/login', {
    method: 'POST',
    body: { email: 'emp2@test.com', password: 'Test@123' },
  });
  assert(r.status === 200, 'login emp2 failed');
  const cookie2 = r.cookie;

  r = await req('/api/entries', {
    method: 'POST',
    cookie: cookie2,
    body: {
      date: '2026-09-06',
      time: '11:15',
      clientName: 'Ram Thapa',
      serviceType: 'Haircut',
      amount: 800,
      paymentType: 'ONLINE',
    },
  });
  assert(r.status === 201, 'emp2 create failed');

  r = await req('/api/entries', {
    method: 'POST',
    cookie: cookie2,
    body: {
      date: '2026-09-05',
      time: '09:00',
      clientName: 'Yesterday Client',
      serviceType: 'Facial',
      amount: 1000,
      paymentType: 'CASH',
    },
  });
  assert(r.status === 201, 'yesterday create failed');

  // USER must not access admin activity
  r = await req('/api/reports/activity?date=2026-09-06', { cookie: cookie1 });
  assert(r.status === 403, `user must be blocked from activity, got ${r.status}`);

  r = await req('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@test.com', password: 'Test@123' },
  });
  assert(r.status === 200, 'admin login failed');
  const cookieAdmin = r.cookie;

  r = await req('/api/reports/activity?date=2026-09-06', { cookie: cookieAdmin });
  assert(r.status === 200, `activity failed: ${r.status} ${JSON.stringify(r.json)}`);
  const { summary, entries } = r.json.data;
  assert(entries.length === 3, `expected 3 entries today, got ${entries.length}`);
  assert(Array.isArray(r.json.data.recent), 'recent feed missing');
  assert(r.json.data.recent.length >= 3, 'recent should include today entries');
  assert(summary.totalServices === 3, 'totalServices');
  assert(summary.totalClients === 3, 'totalClients');
  assert(summary.totalRevenue === 4800, `totalRevenue ${summary.totalRevenue}`);
  assert(summary.cashRevenue === 1500, `cash ${summary.cashRevenue}`);
  assert(summary.onlineRevenue === 3300, `online ${summary.onlineRevenue}`);
  assert(
    entries.some((e) => e.clientName === 'Test Client' && e.employeeName === 'Employee 1'),
    'Test Client / Employee 1 missing'
  );
  assert(
    entries.some((e) => e.clientName === 'Ram Thapa' && e.employeeName === 'Employee 2'),
    'Ram Thapa / Employee 2 missing'
  );

  r = await req('/api/reports/entry-clients', { cookie: cookieAdmin });
  assert(r.status === 200, 'entry-clients failed');
  assert(r.json.data.some((c) => c.name === 'Test Client'), 'Test Client missing from clients list');

  r = await req('/api/reports/activity?date=2026-09-05', { cookie: cookieAdmin });
  assert(r.status === 200, 'historical activity failed');
  assert(r.json.data.entries.length === 1, 'yesterday entries');
  assert(r.json.data.summary.totalRevenue === 1000, 'yesterday revenue');
  assert(r.json.data.summary.cashRevenue === 1000, 'yesterday cash');

  // DB persistence check
  const dbCount = await prisma.serviceEntry.count();
  assert(dbCount === 4, `db should have 4 entries, got ${dbCount}`);

  console.log('OK admin activity: employees → DB → admin dashboard API');
  console.log({ adminId: admin.id, summary });
}

main()
  .catch((e) => {
    console.error('FAIL', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
