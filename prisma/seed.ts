import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.application.upsert({
    where: { packageName: 'app.t2dev.vpn' },
    update: {},
    create: { name: 'T2VPN', packageName: 'app.t2dev.vpn', currency: 'USD' }
  });
}
main().finally(() => prisma.$disconnect());
