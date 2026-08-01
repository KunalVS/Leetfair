import { Router } from 'express';
import crypto from 'node:crypto';
import { env } from '../config/index.js';
import { EventBatchSchema, StartSessionSchema } from '../validation.js';
import { Event } from '../models/Event.js';
import { ContestSession } from '../models/ContestSession.js';
import { Submission } from '../models/Submission.js';
import { Contest } from '../models/Contest.js';
import { isVerified } from '../services/verification.js';
import { markSessionActive, touchSession } from '../services/liveState.js';
import { enqueueSimilarityCheck } from '../queue.js';
export const eventsRouter = Router();
/**
 * POST /sessions/start
 * The extension calls this once per contest problem page load. Returns the
 * sessionId that all subsequent events reference. Requires a verified account
 * so participants can't trivially spoof another user's username.
 */
eventsRouter.post('/sessions/start', async (req, res) => {
    const parsed = StartSessionSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    }
    const input = parsed.data;
    const username = input.username.toLowerCase();
    if (env.REQUIRE_VERIFICATION && !(await isVerified(username))) {
        return res.status(403).json({
            error: 'not_verified',
            message: 'Complete LeetCode-bio verification first (see POST /users/verify). Sessions require a verified account.',
        });
    }
    const contest = await Contest.findById(input.contestId);
    if (!contest) {
        return res.status(404).json({ error: 'contest_not_found', message: input.contestId });
    }
    const now = new Date();
    if (now < contest.startAt || now > contest.endAt) {
        return res.status(409).json({
            error: 'contest_not_active',
            message: 'This contest is not currently accepting sessions.',
        });
    }
    const sessionId = crypto.randomUUID();
    await ContestSession.create({
        sessionId,
        contestId: input.contestId,
        username,
        status: 'active',
        startedAt: now,
        lastSeenAt: now,
    });
    await markSessionActive(input.contestId, username, sessionId);
    // Persist the session_started event for the timeline/transparency view.
    await Event.create({
        eventId: crypto.randomUUID(),
        sessionId,
        contestId: input.contestId,
        username,
        type: 'session_started',
        ts: Date.now(),
        problemSlug: input.problemSlug,
        data: { contestId: input.contestId, pageUrl: input.pageUrl ?? '' },
    });
    return res.status(201).json({ sessionId, contestId: input.contestId, startedAt: now });
});
/**
 * POST /events/batch
 * Main ingest endpoint. Each event is validated independently; malformed
 * events are dropped (and counted) so one bad payload can't nuke a session.
 */
eventsRouter.post('/events/batch', async (req, res) => {
    const parsed = EventBatchSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'invalid_payload', details: parsed.error.flatten() });
    }
    const { events } = parsed.data;
    let stored = 0;
    let ignored = 0;
    let endedSessionIds = [];
    const contestsTouched = new Set();
    const sessionIds = new Set(events.map((e) => e.sessionId));
    const sessions = await ContestSession.find({ sessionId: { $in: [...sessionIds] } }).lean();
    for (const ev of events) {
        const username = ev.username.toLowerCase();
        const session = sessions.find((s) => s.sessionId === ev.sessionId);
        // Every event needs to map to a known session. If the session was started
        // before this event, carry on; otherwise skip the event.
        if (!session) {
            ignored++;
            continue;
        }
        const contestId = session.contestId;
        if (ev.type === 'submission') {
            const submissionId = crypto.randomUUID();
            await Submission.create({
                submissionId,
                sessionId: ev.sessionId,
                contestId,
                username,
                problemSlug: ev.problemSlug,
                language: ev.language,
                status: typeof ev.data.status === 'string' ? ev.data.status : '',
                code: typeof ev.data.code === 'string' ? ev.data.code : '',
            });
            // Async similarity check (winnowing fingerprints + comparisons).
            await enqueueSimilarityCheck(submissionId);
        }
        await Event.create({
            eventId: crypto.randomUUID(),
            sessionId: ev.sessionId,
            contestId,
            username,
            type: ev.type,
            ts: ev.ts,
            problemSlug: ev.problemSlug,
            language: ev.language,
            data: ev.data,
        });
        stored++;
        if (ev.type === 'session_ended') {
            endedSessionIds.push(ev.sessionId);
        }
        contestsTouched.add(contestId);
    }
    // Update session-level aggregates.
    for (const session of sessions) {
        const contestId = session.contestId;
        const userEvents = events.filter((e) => e.sessionId === session.sessionId && e.username.toLowerCase() === session.username);
        const submissionCount = userEvents.filter((e) => e.type === 'submission').length;
        const problems = [...new Set(userEvents.map((e) => e.problemSlug).filter(Boolean))];
        const set = { lastSeenAt: new Date() };
        if (problems.length)
            set.problemSlugs = [...new Set([...(session.problemSlugs ?? []), ...problems])];
        if (submissionCount)
            set.submissionCount = (session.submissionCount ?? 0) + submissionCount;
        await ContestSession.updateOne({ sessionId: session.sessionId }, { $set: set });
        await touchSession(contestId, session.username);
    }
    // Close sessions flagged as ended by the extension.
    if (endedSessionIds.length) {
        for (const sid of endedSessionIds) {
            const ev = events.find((e) => e.sessionId === sid && e.type === 'session_ended');
            await ContestSession.updateOne({ sessionId: sid }, {
                $set: {
                    status: 'closed',
                    endedAt: new Date(),
                    durationMs: ev && typeof ev.data.durationMs === 'number' ? ev.data.durationMs : 0,
                },
            });
        }
    }
    return res.json({ received: events.length, stored, ignored });
});
//# sourceMappingURL=events.js.map