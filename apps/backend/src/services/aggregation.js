import { Event } from '../models/Event.js';
import { ContestSession } from '../models/ContestSession.js';
import { Submission } from '../models/Submission.js';
import { SuspicionScore } from '../models/SuspicionScore.js';
import { computeCohortStats, summarizeEvents, computeSignalZ, combineScores, } from './scoringService.js';
/**
 * Post-contest aggregation: the scheduled job's core routine.
 *
 * 1. Load every event + submission for the contest.
 * 2. Summarize each participant's events into per-signal metrics.
 * 3. Compute cohort z-score statistics (mean/stdDev per signal).
 * 4. For each participant, compute per-signal z-scores and combine them into a
 *    0..100 suspicion score (see config/scoring.ts).
 * 5. Persist SuspicionScore docs and close any lingering active sessions.
 *
 * Scores are a *triage ranking*, not a verdict. Every stored z-score is what
 * the transparency view later renders.
 */
export async function runAggregation(contestId) {
    const events = await Event.find({ contestId }).lean();
    const sessions = await ContestSession.find({ contestId }).lean();
    const submissions = await Submission.find({ contestId }).lean();
    const usernames = new Set([
        ...sessions.map((s) => s.username),
        ...events.map((e) => e.username),
    ]);
    const summaries = new Map();
    const usersSubs = new Map();
    for (const username of usernames) {
        const userEvents = events
            .filter((e) => e.username === username)
            .sort((a, b) => a.ts - b.ts);
        const userSubs = submissions.filter((s) => s.username === username);
        summaries.set(username, summarizeEvents(userEvents, userSubs));
        usersSubs.set(username, userSubs);
    }
    const cohort = computeCohortStats([...summaries.values()]);
    const computedAt = new Date();
    const results = [];
    for (const username of usernames) {
        const summary = summaries.get(username);
        const zScores = {};
        for (const [name] of Object.entries(summary)) {
            zScores[name] = computeSignalZ(name, summary[name], cohort[name]);
        }
        const score = combineScores(zScores);
        await SuspicionScore.findOneAndUpdate({ contestId, username }, {
            $set: {
                score,
                zScores,
                signalStats: summary,
                computedAt,
            },
        }, { upsert: true });
        results.push({ username, score, zScores });
    }
    // Close lingering sessions now the contest is over.
    await ContestSession.updateMany({ contestId, status: 'active' }, { $set: { status: 'closed', endedAt: computedAt } });
    // Best-effort final similarity pass: since the worker compares submissions
    // incrementally, some late submissions may have been compared against a
    // partial set. Recompute maxSimilarity against the full cohort here so the
    // stored signal is the authoritative, complete one.
    await refreshSimilarityForContest(contestId);
    return {
        contestId,
        computedAt,
        participants: usernames.size,
        scores: results.sort((a, b) => b.score - a.score),
    };
}
/** Recompute max similarity per participant against the full contest cohort. */
async function refreshSimilarityForContest(contestId) {
    const submissions = await Submission.find({ contestId }).select('username problemSlug fingerprint').lean();
    const fingerprints = new Map(submissions.map((s) => [s.submissionId, new Set(s.fingerprint)]));
    const byProblem = new Map();
    for (const s of submissions) {
        const key = s.problemSlug ?? '';
        byProblem.set(key, [...(byProblem.get(key) ?? []), s]);
    }
    for (const sub of submissions) {
        if (sub.fingerprint.length === 0)
            continue;
        const mine = fingerprints.get(sub.submissionId);
        let best = 0;
        for (const other of byProblem.get(sub.problemSlug ?? '') ?? []) {
            if (other.submissionId === sub.submissionId)
                continue;
            const theirs = fingerprints.get(other.submissionId);
            if (!theirs || theirs.size === 0)
                continue;
            let shared = 0;
            const [small, large] = mine.size <= theirs.size ? [mine, theirs] : [theirs, mine];
            for (const h of small)
                if (large.has(h))
                    shared++;
            const sim = shared / small.size;
            if (sim > best)
                best = sim;
        }
        await Submission.updateOne({ submissionId: sub.submissionId }, { $max: { maxSimilarity: best } });
    }
}
//# sourceMappingURL=aggregation.js.map