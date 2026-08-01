import cron from 'node-cron';
import { Contest } from '../models/Contest.js';
import { runAggregation } from '../services/aggregation.js';
import { clearContestLiveState } from '../services/liveState.js';
/**
 * Scheduled post-contest aggregation.
 *
 * Every minute this checks for contests that have ended but not yet been
 * aggregated, runs the aggregation (z-score normalization + weighted suspicion
 * score), and clears their live session state.
 *
 * Contest organizers can also trigger aggregation manually with
 * POST /contests/:id/aggregate.
 */
export function startScheduledJobs() {
    cron.schedule('* * * * *', async () => {
        const now = new Date();
        const due = await Contest.find({
            endAt: { $lte: now },
            aggregatedAt: null,
        });
        for (const contest of due) {
            try {
                // eslint-disable-next-line no-console
                console.log(`[jobs] aggregating contest ${contest._id} (${contest.name})`);
                await runAggregation(String(contest._id));
                contest.aggregatedAt = new Date();
                await contest.save();
                // Clear volatile live session state now the contest is closed.
                await clearContestLiveState(String(contest._id));
            }
            catch (err) {
                // eslint-disable-next-line no-console
                console.error(`[jobs] aggregation failed for ${contest._id}:`, err);
            }
        }
    });
}
//# sourceMappingURL=contestCloseJob.js.map