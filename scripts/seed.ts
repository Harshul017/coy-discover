/** Seed (or reset) the database. Usage: npm run seed -- --reset */
import { getDb, migrate } from '../src/lib/db/client';
import { seed } from '../src/lib/db/seed';

async function main() {
  const reset = process.argv.includes('--reset');
  const db = getDb();
  await migrate(db);
  const result = await seed(db, { reset });
  console.log(
    `Seeded ${result.profiles} profiles (${result.admirers} of them already like you)${
      reset ? ' after a full reset' : ''
    }.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
