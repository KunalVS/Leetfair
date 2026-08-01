/**
 * Minimal in-process job queue for async similarity checks.
 *
 * Replaces BullMQ + Redis for local/dev runs: jobs are processed in the same
 * process, one at a time, as they arrive. If the process restarts mid-contest,
 * pending jobs are lost — but the post-contest aggregation performs a full
 * similarity refresh anyway, so scores remain correct.
 *
 * For production, swap this for BullMQ (the handler signature stays the same).
 */
let handler = null;
const pending = [];
let running = false;
/** The worker registers its handler once at boot. */
export function registerSimilarityHandler(fn) {
    handler = fn;
    void pump();
}
export async function enqueueSimilarityCheck(submissionId) {
    pending.push({ submissionId });
    void pump();
}
async function pump() {
    if (running)
        return;
    running = true;
    try {
        while (pending.length > 0) {
            const job = pending.shift();
            if (!handler)
                continue;
            try {
                await handler(job);
            }
            catch (err) {
                // eslint-disable-next-line no-console
                console.error('[similarity] job failed:', err.message);
            }
        }
    }
    finally {
        running = false;
    }
}
//# sourceMappingURL=queue.js.map