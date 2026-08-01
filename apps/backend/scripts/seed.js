/**
 * Demo seed CLI:
 *
 *   npm run seed
 *
 * Seeds an in-memory (or MONGODB_URI) database with a demo contest, then
 * prints the aggregated suspicion scores. Note: with the default in-memory
 * database, data lives only inside this process — set SEED_DEMO=true when
 * starting the server if you want the dashboard to show the demo data.
 */
import { connectDatabase, disconnectDatabase } from '../src/db.js';
import { seedDemoData } from '../src/services/seedDemo.js';

async function main() {
  await connectDatabase();
  const { contestId, scores } = await seedDemoData();

  console.log('Aggregated scores:');
  for (const s of scores) console.log(`  ${s.username.padEnd(14)} ${s.score.toFixed(2)}`);
  console.log(`Contest _id: ${contestId}`);

  await disconnectDatabase();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
