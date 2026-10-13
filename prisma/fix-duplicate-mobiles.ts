/**
 * One-time pre-migration step: the incoming schema adds a UNIQUE constraint
 * to users.mobileNumber. Earlier test signups (pre-dating that constraint)
 * left duplicate numbers in place, which makes `prisma db push` fail with
 * P2002. This disambiguates duplicates (oldest account keeps the original
 * number, later ones get a suffix) rather than deleting any accounts —
 * runs before `db push`, so the column is still a plain unique-less text
 * field when this executes. Safe to run repeatedly; it's a no-op once
 * there are no duplicates left.
 */
import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, mobileNumber: true },
  });

  const byNumber = new Map<string, string[]>();
  for (const u of users) {
    const list = byNumber.get(u.mobileNumber) ?? [];
    list.push(u.id);
    byNumber.set(u.mobileNumber, list);
  }

  let fixed = 0;
  for (const [number, ids] of byNumber) {
    if (ids.length <= 1) continue;
    // Keep the oldest account's number as-is; suffix the rest.
    for (let i = 1; i < ids.length; i++) {
      const newNumber = `${number}-dup${i}`;
      await prisma.user.update({ where: { id: ids[i] }, data: { mobileNumber: newNumber } });
      console.log(`Disambiguated duplicate mobileNumber ${number} -> ${newNumber} (user ${ids[i]})`);
      fixed++;
    }
  }

  console.log(fixed > 0 ? `Fixed ${fixed} duplicate mobile number(s).` : "No duplicate mobile numbers found.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
