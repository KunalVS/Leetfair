import { Router } from 'express';
import { VerifyStartSchema, VerifyCompleteSchema } from '../validation.js';
import { startVerification, completeVerification } from '../services/verification.js';
import { Event } from '../models/Event.js';
import { SuspicionScore } from '../models/SuspicionScore.js';
import { Submission } from '../models/Submission.js';
import { ContestSession } from '../models/ContestSession.js';
export const usersRouter = Router();
/**
 * POST /users/verify  { username }
 * Starts verification and returns a token the participant must paste into
 * their LeetCode profile bio.
 */
usersRouter.post('/users/verify', async (req, res) => {
    const parsed = VerifyStartSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    }
    const token = await startVerification(parsed.data.username);
    return res.json({
        username: parsed.data.username.toLowerCase(),
        token,
        instructions: `Paste this exact string into your LeetCode profile bio (Profile → Summary), ` +
            `then call POST /users/verify/complete.`,
    });
});
/**
 * POST /users/verify/complete  { username }
 * Re-checks the public profile bio for the token. Reports verified=true/false.
 */
usersRouter.post('/users/verify/complete', async (req, res) => {
    const parsed = VerifyCompleteSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    }
    const result = await completeVerification(parsed.data.username);
    return res.json({ username: parsed.data.username.toLowerCase(), ...result });
});
/**
 * GET /users/:username/events?contestId=
 * Raw event timeline for one participant — used by the moderator drill-down.
 */
usersRouter.get('/users/:username/events', async (req, res) => {
    const username = req.params.username.toLowerCase();
    const { contestId } = req.query;
    const filter = { username };
    if (contestId)
        filter.contestId = String(contestId);
    const [events, sessions] = await Promise.all([
        Event.find(filter).sort({ ts: 1 }).limit(5000).lean(),
        ContestSession.find(filter).sort({ startedAt: 1 }).lean(),
    ]);
    res.json({ username, contestId: contestId ?? null, sessions, events });
});
/**
 * GET /users/:username/transparency?contestId=
 * PUBLIC, self-serve view: a participant can see exactly what was recorded
 * about them, their per-signal z-scores, and how the score was derived.
 * Deliberately redacts the identity of anyone else they may have matched.
 */
usersRouter.get('/users/:username/transparency', async (req, res) => {
    const username = req.params.username.toLowerCase();
    const { contestId } = req.query;
    const filter = { username };
    if (contestId)
        filter.contestId = String(contestId);
    const scores = await SuspicionScore.find(filter).sort({ computedAt: -1 }).lean();
    const events = await Event.find(filter).sort({ ts: 1 }).limit(2000).lean();
    const submissions = await Submission.find(filter).lean();
    const redactedSubmissions = submissions.map((s) => ({
        submissionId: s.submissionId,
        problemSlug: s.problemSlug,
        language: s.language,
        status: s.status,
        code: s.code.length > 4000 ? `${s.code.slice(0, 4000)}…` : s.code,
        maxSimilarity: s.maxSimilarity,
        matched: s.matchedAgainst
            ? {
                source: s.matchedAgainst.source,
                similarity: s.matchedAgainst.similarity,
                // Identify the *kind* of match but not the other participant.
                otherUsername: s.matchedAgainst.source === 'corpus' ? s.matchedAgainst.otherUsername : '(another participant)',
            }
            : null,
    }));
    // Summarize per-signal metric counts for a plain-English explanation.
    const counts = {};
    for (const e of events)
        counts[e.type] = (counts[e.type] ?? 0) + 1;
    res.json({
        username,
        contestId: contestId ?? null,
        scores,
        eventCounts: counts,
        submissions: redactedSubmissions,
    });
});
//# sourceMappingURL=users.js.map