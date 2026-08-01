import { env } from './config/index.js';
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './db.js';
import { startSimilarityWorker } from './workers/similarityWorker.js';
import { startScheduledJobs } from './jobs/contestCloseJob.js';
import { seedDemoData } from './services/seedDemo.js';
/**
 * Boot sequence:
 *   1. MongoDB (in-memory by default — no Docker needed; set MONGODB_URI to
 *      use an external instance)
 *   2. Express API
 *   3. In-process similarity worker (no Redis/BullMQ required)
 *   4. Scheduled post-contest aggregation
 */
async function main() {
    const uri = await connectDatabase();
    // eslint-disable-next-line no-console
    console.log(`[db] connected (${uri})`);
    if (env.SEED_DEMO) {
        const { contestId, scores } = await seedDemoData();
        // eslint-disable-next-line no-console
        console.log(`[demo] seeded contest ${contestId}:`);
        // eslint-disable-next-line no-console
        for (const s of scores)
            console.log(`  ${s.username.padEnd(14)} ${s.score.toFixed(2)}`);
    }
    const app = createApp();
    app.listen(env.PORT, () => {
        // eslint-disable-next-line no-console
        console.log(`[api] LeetFair backend listening on http://localhost:${env.PORT}`);
    });
    startSimilarityWorker();
    startScheduledJobs();
    // eslint-disable-next-line no-console
    console.log('[jobs] similarity worker + scheduled aggregation started');
}
async function shutdown() {
    // eslint-disable-next-line no-console
    console.log('[api] shutting down…');
    await disconnectDatabase();
    process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[boot] fatal error:', err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map