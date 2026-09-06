/**
 * Safe database reset for clean testing.
 * - Clears ALL application data (users, appointments, clients, services)
 * - Keeps the database and Prisma schema/tables intact
 * - Does NOT create any admin/demo accounts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const required = ['DATABASE_URL'] as const;
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    console.error('Copy .env.example to .env and set DATABASE_URL before resetting.');
    process.exit(1);
  }
}

const prisma = new PrismaClient();

async function main() {
  console.log('Resetting database to a clean testing state...');

  // Order matters because of foreign keys
  const entries = await prisma.serviceEntry.deleteMany();
  const appointments = await prisma.appointment.deleteMany();
  const clients = await prisma.client.deleteMany();
  const services = await prisma.service.deleteMany();
  const users = await prisma.user.deleteMany();

  console.log(`Removed ${entries.count} service entries`);
  console.log(`Removed ${appointments.count} appointments`);
  console.log(`Removed ${clients.count} clients`);
  console.log(`Removed ${services.count} services`);
  console.log(`Removed ${users.count} users/accounts`);
  console.log('Database cleared successfully. No accounts remain.');
}

main()
  .catch((err) => {
    console.error('Database reset failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
