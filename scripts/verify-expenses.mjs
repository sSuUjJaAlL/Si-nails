import { PrismaClient, Role, UserStatus, ExpenseCategory } from '@prisma/client';
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
  await prisma.expense.deleteMany();
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
  const userA = await prisma.user.create({
    data: {
      name: 'Sujal',
      email: 'sujal@test.com',
      passwordHash: hash,
      role: Role.USER,
      status: UserStatus.ACTIVE,
    },
  });
  const userB = await prisma.user.create({
    data: {
      name: 'User B',
      email: 'userb@test.com',
      passwordHash: hash,
      role: Role.USER,
      status: UserStatus.ACTIVE,
    },
  });

  let r = await req('/api/auth/login', {
    method: 'POST',
    body: { email: 'sujal@test.com', password: 'Test@123' },
  });
  assert(r.status === 200, 'login A');
  const cookieA = r.cookie;

  r = await req('/api/expenses', {
    method: 'POST',
    cookie: cookieA,
    body: {
      description: 'Petrol',
      category: ExpenseCategory.TRANSPORTATION,
      amount: 1500,
      date: '2026-09-07',
      userId: userB.id, // must be ignored
    },
  });
  assert(r.status === 201, `user create ${r.status}`);
  assert(r.json.data.userId === userA.id, 'ownership forced to self');
  assert(r.json.data.createdById === userA.id, 'createdBy self');

  r = await req('/api/expenses', { cookie: cookieA });
  assert(r.status === 200 && r.json.data.length === 1, 'user A sees own');
  assert(r.json.summary.totalExpenses === 1500, 'user A total');

  r = await req('/api/auth/login', {
    method: 'POST',
    body: { email: 'userb@test.com', password: 'Test@123' },
  });
  const cookieB = r.cookie;
  r = await req('/api/expenses', { cookie: cookieB });
  assert(r.json.data.length === 0, 'user B isolated');
  assert(r.json.summary.totalExpenses === 0, 'user B total 0');

  r = await req('/api/auth/login', {
    method: 'POST',
    body: { email: 'admin@test.com', password: 'Test@123' },
  });
  const cookieAdmin = r.cookie;

  r = await req('/api/expenses', {
    method: 'POST',
    cookie: cookieAdmin,
    body: {
      description: 'Admin personal',
      category: ExpenseCategory.OTHER,
      amount: 999,
      date: '2026-09-07',
    },
  });
  assert(r.status === 400, 'admin must select user');

  r = await req('/api/expenses', {
    method: 'POST',
    cookie: cookieAdmin,
    body: {
      description: 'Food',
      category: ExpenseCategory.FOOD,
      amount: 500,
      date: '2026-09-07',
      userId: userA.id,
    },
  });
  assert(r.status === 201, 'admin for user A');
  assert(r.json.data.userId === userA.id, 'belongs to A');
  assert(r.json.data.createdByRole === 'ADMIN' || r.json.data.createdByName === 'Admin', 'added by admin');

  r = await req(`/api/expenses?userId=${userA.id}`, { cookie: cookieAdmin });
  assert(r.json.data.length === 2, 'admin sees both for A');
  assert(r.json.summary.totalExpenses === 2000, 'A total 2000');

  r = await req('/api/expenses', {
    method: 'POST',
    cookie: cookieAdmin,
    body: {
      description: 'Bad',
      category: ExpenseCategory.OTHER,
      amount: 100,
      date: '2026-09-07',
      userId: (await prisma.user.findFirst({ where: { role: Role.ADMIN } })).id,
    },
  });
  assert(r.status === 400, 'cannot assign expense to admin');

  console.log('OK role-based expenses');
}

main()
  .catch((e) => {
    console.error('FAIL', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
