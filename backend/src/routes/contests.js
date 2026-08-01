import { Router } from 'express';
import { CreateContestSchema } from '../validation.js';
import { Contest } from '../models/Contest.js';
import { SuspicionScore } from '../models/SuspicionScore.js';
import { ContestSession } from '../models/ContestSession.js';
import { isModerator } from '../config/index.js';
import { runAggregation } from '../services/aggregation.js';
import { getLiveParticipants } from '../services/liveState.js';
export const contestsRouter = Router();
function requireModerator(req, res) {
    const username = String(req.body.createdBy ?? req.query.moderator ?? '');
    if (!isModerator(username)) {
        res
            .status(403)
            .json({ error: 'forbidden', message: 'This action requires a moderator account.' });
        return false;
    }
    return true;
}
/**
 * POST /contests  { name, startAt, endAt, createdBy, problemSlugs? }
 * Create a contest. Requires a moderator username (or open mode).
 */
contestsRouter.post('/contests', async (req, res) => {
    const parsed = CreateContestSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    }
    if (!requireModerator(req, res))
        return;
    const contest = await Contest.create(parsed.data);
    res.status(201).json(contest);
});
/**
 * GET /contests/by-slug/:slug
 * Lets the extension resolve a LeetCode contest URL (e.g.
 * /contest/demo-weekly-1/problems/two-sum) to a registered contest id.
 */
contestsRouter.get('/contests/by-slug/:slug', async (req, res) => {
    const contest = await Contest.findOne({ slug: req.params.slug }).lean();
    if (!contest)
        return res.status(404).json({ error: 'contest_not_found' });
    res.json({
        _id: String(contest._id),
        name: contest.name,
        slug: contest.slug,
        startAt: contest.startAt,
        endAt: contest.endAt,
    });
});
/**
 * GET /contests/:id
 * Contest metadata plus who is live right now (from the in-memory live store).
 */
contestsRouter.get('/contests/:id', async (req, res) => {
    const contest = await Contest.findById(req.params.id).lean();
    if (!contest)
        return res.status(404).json({ error: 'contest_not_found' });
    const liveParticipants = await getLiveParticipants(String(contest._id));
    res.json({ ...contest, liveParticipants });
});
/**
 * GET /contests/:id/scores
 * Ranked suspicion scores for a contest. Sorted descending. This is the
 * moderator triage list — never an auto-ban.
 */
contestsRouter.get('/contests/:id/scores', async (req, res) => {
    const scores = await SuspicionScore.find({ contestId: req.params.id })
        .sort({ score: -1 })
        .lean();
    res.json({ contestId: req.params.id, scores });
});
/**
 * POST /contests/:id/aggregate
 * Manually trigger the post-contest aggregation + scoring for a contest
 * (normally done automatically by the scheduled job shortly after endAt).
 */
contestsRouter.post('/contests/:id/aggregate', async (req, res) => {
    if (!requireModerator(req, res))
        return;
    try {
        const result = await runAggregation(req.params.id);
        await Contest.updateOne({ _id: req.params.id }, { $set: { aggregatedAt: result.computedAt } });
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: 'aggregation_failed', message: err.message });
    }
});
/** GET /contests — list contests (moderator dashboard bootstrap). */
contestsRouter.get('/contests', async (_req, res) => {
    const contests = await Contest.find().sort({ startAt: -1 }).limit(100).lean();
    const sessions = await ContestSession.aggregate([
        { $group: { _id: '$contestId', participants: { $addToSet: '$username' } } },
    ]);
    const counts = {};
    for (const s of sessions)
        counts[String(s._id)] = s.participants.length;
    const list = contests.map((c) => ({
        ...c,
        participantCount: counts[String(c._id)] ?? 0,
    }));
    res.json(list);
});
//# sourceMappingURL=contests.js.map