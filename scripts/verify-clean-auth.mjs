import { PrismaClient } from '@prisma/client';

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

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  await prisma.serviceEntry.deleteMany().catch(() => {});
  await prisma.appointment.deleteMany();
  await prisma.client.deleteMany();
  await prisma.service.deleteMany();
  await prisma.user.deleteMany();

  let r = await req('/api/auth/setup-status');
  assert(r.json.setupRequired === true, 'setup should be required with empty DB');

  r = await req('/api/auth/signup', {
    method: 'POST',
    body: {
      name: 'Blocked User',
      email: 'blocked@test.com',
      password: 'User@123',
      confirmPassword: 'User@123',
    },
  });
  assert(r.status === 403, 'signup must be blocked before admin exists');

  r = await req('/api/auth/setup', {
    method: 'POST',
    body: {
      name: 'First Admin',
      email: 'admin1@test.com',
      password: 'Admin@123',
      confirmPassword: 'Admin@123',
    },
  });
  assert(r.status === 201 && r.json.user.role === 'ADMIN', 'first admin failed');
  let adminCookie = r.cookie;

  r = await req('/api/auth/setup-status');
  assert(r.json.setupRequired === false, 'setup should be complete after admin');

  r = await req('/api/auth/signup', {
    method: 'POST',
    body: {
      name: 'Normal User',
      email: 'user1@test.com',
      password: 'User@123',
      confirmPassword: 'User@123',
      role: 'ADMIN',
    },
  });
  assert(r.status === 201 && r.json.user.role === 'USER', 'signup must force USER');
  const userCookie = r.cookie;

  r = await req('/api/users', { cookie: userCookie });
  assert(r.status === 403, 'user cannot list users');

  r = await req('/api/users', {
    method: 'POST',
    cookie: adminCookie,
    body: {
      name: 'Second Admin',
      email: 'admin2@test.com',
      password: 'Admin@123',
      confirmPassword: 'Admin@123',
      role: 'ADMIN',
    },
  });
  assert(r.status === 201 && r.json.data.role === 'ADMIN', 'second admin failed');

  r = await req('/api/users', {
    method: 'POST',
    cookie: adminCookie,
    body: {
      name: 'Third Admin',
      email: 'admin3@test.com',
      password: 'Admin@123',
      confirmPassword: 'Admin@123',
      role: 'ADMIN',
    },
  });
  assert(r.status === 409, 'third admin must be rejected');
  console.log('third admin rejected:', r.json.message);

  r = await req('/api/auth/setup', {
    method: 'POST',
    body: {
      name: 'X',
      email: 'x@test.com',
      password: 'Admin@123',
      confirmPassword: 'Admin@123',
    },
  });
  assert(r.status === 403, 'setup after users must fail');

  console.log('ALL CLEAN-STATE AUTH TESTS PASSED');
}

main()
  .catch((e) => {
    console.error('FAILED', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
