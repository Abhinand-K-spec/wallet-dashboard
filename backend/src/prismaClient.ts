import { PrismaClient } from '@prisma/client';

const dbUrl = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
});

export default prisma;
