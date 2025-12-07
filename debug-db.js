const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

const log = (msg) => {
    console.log(msg);
    fs.appendFileSync('debug_log.txt', JSON.stringify(msg) + '\n');
};

async function main() {
    try {
        log('Connecting to database...');
        const user = await prisma.user.findUnique({ where: { email: 'mahasiswa@example.com' } });
        log({ msg: 'User found', user });
        if (user) {
            const mahasiswa = await prisma.mahasiswa.findFirst({ where: { user_id: user.user_id } });
            log({ msg: 'Mahasiswa found', mahasiswa });
        } else {
            log('User not found!');
        }
    } catch (e) {
        log({ msg: 'Error', error: e.message, stack: e.stack });
    } finally {
        await prisma.$disconnect();
    }
}

main();
