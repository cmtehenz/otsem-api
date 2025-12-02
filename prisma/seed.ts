import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
const prisma = new PrismaClient();

async function main() {
    const email = 'admin@otsembank.com';
    const pwd = await bcrypt.hash('Admin@123', 10);
    await prisma.user.upsert({
        where: { email },
        update: {},
        create: { email, password: pwd, role: Role.ADMIN, name: 'Admin' },
    });
    console.log('admin ok:', email);
}

main().finally(() => prisma.$disconnect());
