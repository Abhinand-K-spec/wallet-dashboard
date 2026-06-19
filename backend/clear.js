const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== STARTING DATABASE CLEANUP ===');

  try {
    // 1. Delete dependent transaction records
    const deletedTransactions = await prisma.transaction.deleteMany({});
    console.log(`Deleted ${deletedTransactions.count} transactions.`);

    // 2. Delete wallet deposits
    const deletedDeposits = await prisma.walletDeposit.deleteMany({});
    console.log(`Deleted ${deletedDeposits.count} deposits.`);

    // 3. Delete withdrawals
    const deletedWithdrawals = await prisma.withdrawal.deleteMany({});
    console.log(`Deleted ${deletedWithdrawals.count} withdrawals.`);

    // 4. Delete admin actions
    const deletedAdminActions = await prisma.adminAction.deleteMany({});
    console.log(`Deleted ${deletedAdminActions.count} admin actions.`);

    // 5. Delete non-default user accounts
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        NOT: [
          { email: 'admin@wallet.com' },
          { email: 'user@wallet.com' }
        ]
      }
    });
    console.log(`Deleted ${deletedUsers.count} custom user accounts.`);

    console.log('=== DATABASE CLEANUP COMPLETED ===');
  } catch (error) {
    console.error('Error resetting database:', error);
  }
}

main()
  .catch((e) => {
    console.error('Unhandled error in script:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
