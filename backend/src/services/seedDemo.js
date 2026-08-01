/**
 * Demo data generator: creates a contest, a handful of participants (some
 * honest, one clearly suspicious), sample behavioral events, then runs the
 * aggregation so SuspicionScore documents exist for the dashboard to render.
 *
 * Used by the CLI seed script (npm run seed) and optionally on server boot
 * (SEED_DEMO=true).
 */
import crypto from 'node:crypto';
import { Contest } from '../models/Contest.js';
import { User } from '../models/User.js';
import { ContestSession } from '../models/ContestSession.js';
import { Event } from '../models/Event.js';
import { Submission } from '../models/Submission.js';
import { runAggregation } from './aggregation.js';
const HONEST_CODE = `
class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        for i in range(len(nums)):
            for j in range(i + 1, len(nums)):
                if nums[i] + nums[j] == target:
                    return [i, j]
`;
const SUSPICIOUS_CODE = `
class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        seen = {}
        for i, n in enumerate(nums):
            complement = target - n
            if complement in seen:
                return [seen[complement], i]
            seen[n] = i
        return []
`;
export async function seedDemoData() {
    await Promise.all([
        User.deleteMany({}),
        Contest.deleteMany({}),
        ContestSession.deleteMany({}),
        Event.deleteMany({}),
        Submission.deleteMany({}),
    ]);
    const now = new Date();
    const contest = await Contest.create({
        name: 'Demo League — Weekly #1',
        slug: 'demo-weekly-1',
        startAt: new Date(now.getTime() - 3 * 3600_000),
        endAt: new Date(now.getTime() + 1 * 3600_000),
        createdBy: 'moderator',
        problemSlugs: ['two-sum', 'valid-parentheses'],
    });
    // Simulated participants. Typing std-dev ~0 and instant solves = suspicious.
    const users = [
        {
            username: 'honest_ada',
            minutes: 45,
            pastes: [18, 4, 22, 9],
            focusLossMs: [4000, 15000, 3000, 8000, 25000],
            typingMeans: [140, 210, 175],
            typingStds: [95, 130, 88],
            devtoolsOpenMs: 0,
            ttfSeconds: 480,
            code: HONEST_CODE,
            codeSimilarity: 0.3,
        },
        {
            username: 'steady_ben',
            minutes: 38,
            pastes: [3, 6],
            focusLossMs: [2000, 5000],
            typingMeans: [160, 190],
            typingStds: [105, 120],
            devtoolsOpenMs: 0,
            ttfSeconds: 610,
            code: HONEST_CODE,
            codeSimilarity: 0.35,
        },
        {
            username: 'dubious_cam',
            minutes: 12,
            pastes: [410, 12, 380, 25],
            focusLossMs: [90000, 140000, 20000],
            typingMeans: [42, 55],
            typingStds: [4, 6], // robotically regular
            devtoolsOpenMs: 150_000,
            ttfSeconds: 95,
            code: SUSPICIOUS_CODE,
            codeSimilarity: 0.95,
        },
    ];
    for (const u of users) {
        // Verified account.
        await User.create({
            username: u.username,
            verification: {
                token: `LEETFAIR-demo-${u.username}`,
                verifiedAt: new Date(),
                bioCheckedAt: new Date(),
            },
        });
        const sessionId = crypto.randomUUID();
        const startedAt = new Date(now.getTime() - u.minutes * 60_000);
        await ContestSession.create({
            sessionId,
            contestId: String(contest._id),
            username: u.username,
            status: 'closed',
            startedAt,
            endedAt: now,
            durationMs: u.minutes * 60_000,
            submissionCount: 2,
            problemSlugs: ['two-sum'],
        });
        let ts = startedAt.getTime();
        const events = [];
        const push = (e) => {
            events.push({
                eventId: crypto.randomUUID(),
                sessionId,
                contestId: String(contest._id),
                username: u.username,
                ts,
                ...e,
            });
        };
        push({
            type: 'session_started',
            data: { contestId: String(contest._id), pageUrl: 'https://leetcode.com/problems/two-sum/' },
        });
        ts += 5_000;
        for (const pasteSize of u.pastes) {
            ts += 40_000;
            push({ type: 'paste', problemSlug: 'two-sum', data: { size: pasteSize, totalSessionBytes: 0 } });
        }
        for (const [i, mean] of u.typingMeans.entries()) {
            ts += 25_000;
            push({
                type: 'typing',
                problemSlug: 'two-sum',
                data: { intervalMeanMs: mean, intervalStdDevMs: u.typingStds[i], keyCount: 80, totalTyped: 0 },
            });
        }
        for (const dur of u.focusLossMs) {
            ts += 30_000;
            push({ type: 'focus_change', data: { state: 'hidden', durationMs: dur, totalFocusLossMs: 0, sessionMs: 0 } });
        }
        if (u.devtoolsOpenMs > 0) {
            ts += 10_000;
            push({ type: 'devtools_open', data: { open: true, totalOpenMs: u.devtoolsOpenMs, sessionMs: 0 } });
        }
        ts += 20_000;
        push({ type: 'time_to_first_submit', problemSlug: 'two-sum', data: { seconds: u.ttfSeconds } });
        ts += 10_000;
        const firstSubmissionId = crypto.randomUUID();
        push({
            type: 'submission',
            problemSlug: 'two-sum',
            language: 'python3',
            data: { status: 'Accepted', code: u.code, firstSubmission: true },
        });
        await Submission.create({
            submissionId: firstSubmissionId,
            sessionId,
            contestId: String(contest._id),
            username: u.username,
            problemSlug: 'two-sum',
            language: 'python3',
            status: 'Accepted',
            code: u.code,
            fingerprint: [],
            maxSimilarity: u.codeSimilarity,
            matchedAgainst: { source: 'participant', similarity: u.codeSimilarity },
        });
        ts += 30_000;
        push({ type: 'session_ended', data: { durationMs: u.minutes * 60_000, submissionCount: 2 } });
        await Event.insertMany(events);
    }
    const result = await runAggregation(String(contest._id));
    return { contestId: String(contest._id), scores: result.scores };
}
//# sourceMappingURL=seedDemo.js.map