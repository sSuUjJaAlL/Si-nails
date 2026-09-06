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
  const userA = await prisma.user.create({
    data: {
      name: 'Worker A',
      email: 'workera@test.com',
      passwordHash: hash,
      role: Role.USER,
      status: UserStatus.ACTIVE,
    },
  });
  const userB = await prisma.user.create({
    data: {
      name: 'Worker B',
      email: 'workerb@test.com',
      passwordHash: hash,
      role: Role.USER,
      status: UserStatus.ACTIVE,
    },
  });

  let r = await req('/api/auth/login', {
    method: 'POST',
    body: { email: 'workera@test.com', password: 'Test@123' },
  });
  assert(r.status === 200, 'login A failed');
  const cookieA = r.cookie;

  r = await req('/api/entries', {
    method: 'POST',
    cookie: cookieA,
    body: {
      date: '2026-09-06',
      time: '10:30',
      clientName: 'Sita Sharma',
      serviceType: 'Facial',
      amount: 1500,
      paymentType: 'CASH',
    },
  });
  assert(r.status === 201, 'create failed');
  const id = r.json.data.id;
  assert(r.json.data.clientName === 'Sita Sharma', 'client name');
  assert(r.json.data.serviceType === 'Facial', 'service');

  r = await req('/api/entries', {
    method: 'POST',
    cookie: cookieA,
    body: {
      date: '2026-09-06',
      time: '11:00',
      clientName: 'X',
      serviceType: 'Y',
      amount: 100,
      paymentType: 'CARD',
    },
  });
  assert(r.status === 400, 'invalid payment must fail');

  r = await req(`/api/entries/${id}`, {
    method: 'PUT',
    cookie: cookieA,
    body: {
      date: '2026-09-06',
      time: '10:45',
      clientName: 'Sita Sharma',
      serviceType: 'Facial',
      amount: 1600,
      paymentType: 'ONLINE',
    },
  });
  assert(r.status === 200 && r.json.data.amount === 1600, 'update failed');

  r = await req('/api/auth/login', {
    method: 'POST',
    body: { email: 'workerb@test.com', password: 'Test@123' },
  });
  const cookieB = r.cookie;

  r = await req('/api/entries', { cookie: cookieB });
  assert(r.status === 200 && r.json.data.length === 0, 'B should not see A entries');

  r = await req(`/api/entries/${id}`, {
    method: 'DELETE',
    cookie: cookieB,
  });
  assert(r.status === 403, 'B cannot delete A entry');

  r = await req(`/api/entries/${id}`, { method: 'DELETE', cookie: cookieA });
  assert(r.status === 200, 'A delete failed');

  console.log('ENTRIES TESTS PASSED', { userA: userA.id, userB: userB.id });
}

main()
  .catch((e) => {
    console.error('FAILED', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
