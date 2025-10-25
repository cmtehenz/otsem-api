// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
    const email = process.env.SEED_ADMIN_EMAIL || 'admin@otsembank.com';
    const name = process.env.SEED_ADMIN_NAME || 'Admin';
    const password = process.env.SEED_ADMIN_PASSWORD || 'troque-me-123';

    const passwordHash = await argon2.hash(password);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
        console.log(`Admin já existe: ${email}`);
        return;
    }

    await prisma.user.create({
        data: {
            name,
            email,
            passwordHash,
            role: 'ADMIN',
            isActive: true,
        },
    });

    console.log('Admin criado com sucesso:');
    console.log({ email, password });
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
}).finally(async () => {
    await prisma.$disconnect();
});
