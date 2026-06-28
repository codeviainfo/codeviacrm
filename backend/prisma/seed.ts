import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@codevia.com";
  const password = process.env.SEED_ADMIN_PASSWORD || "codevia123";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Usuario admin ya existe: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { email, passwordHash, name: "Admin Codevia" },
  });

  console.log(`Usuario admin creado: ${email} / ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
