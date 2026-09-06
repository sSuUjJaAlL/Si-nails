import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const adminCount = await prisma.user.count({ where: { role: Role.ADMIN } });
  const userCount = await prisma.user.count();
  console.log(JSON.stringify({ adminCount, userCount, setupRequired: adminCount === 0 }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
