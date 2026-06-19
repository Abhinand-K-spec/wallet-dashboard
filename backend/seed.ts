
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  await prisma.user.upsert({
    where: { email: 'admin@wallet.com' },
    update: {},
    create: {
      userId: 'USR-ADMIN',
      email: 'admin@wallet.com',
      passwordHash,
      role: 'ADMIN',
    },
  });

  await prisma.user.upsert({
    where: { email: 'user@wallet.com' },
    update: {},
    create: {
      userId: 'USR-1000',
      email: 'user@wallet.com',
      passwordHash,
      role: 'USER',
    },
  });

  console.log('Database seeded with admin and test user.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
