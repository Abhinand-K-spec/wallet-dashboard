const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'user@wallet.com' },
  });

  if (!user) {
    console.error('User not found. Run seed script first.');
    return;
  }

  // 1. Success mock deposit
  await prisma.walletDeposit.upsert({
    where: { txHash: 'mock-trx-123' },
    update: {
      status: 'PENDING',
      amountUSD: 1000.0,
      walletAddress: 'TMockUserWalletAddress777777777777777',
    },
    create: {
      userId: user.id,
      txHash: 'mock-trx-123',
      amountUSD: 1000.0,
      walletAddress: 'TMockUserWalletAddress777777777777777',
      status: 'PENDING',
    },
  });

  // 2. Mock amount mismatch deposit (submitted $50.00, mock verified $1000.00)
  await prisma.walletDeposit.upsert({
    where: { txHash: 'mock-trx-amount-mismatch' },
    update: {
      status: 'PENDING',
      amountUSD: 50.0,
      walletAddress: 'TMockUserWalletAddress777777777777777',
      onChainVerified: false,
    },
    create: {
      userId: user.id,
      txHash: 'mock-trx-amount-mismatch',
      amountUSD: 50.0,
      walletAddress: 'TMockUserWalletAddress777777777777777',
      status: 'PENDING',
      onChainVerified: false,
    },
  });

  // 3. Failed live lookup deposit
  const fakeHash = '1111111111111111111111111111111111111111111111111111111111111111';
  await prisma.walletDeposit.upsert({
    where: { txHash: fakeHash },
    update: {
      status: 'PENDING',
      amountUSD: 250.0,
      walletAddress: 'TFakeUserWalletAddress11111111111111',
      onChainVerified: false,
    },
    create: {
      userId: user.id,
      txHash: fakeHash,
      amountUSD: 250.0,
      walletAddress: 'TFakeUserWalletAddress11111111111111',
      status: 'PENDING',
      onChainVerified: false,
    },
  });

  console.log('Inserted custom test deposits for admin dashboard testing.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
