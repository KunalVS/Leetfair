import { registerSimilarityHandler } from '../queue.js';
import { Submission } from '../models/Submission.js';
import { fingerprint, overlapCoefficient } from '../services/similarity.js';
import { KNOWN_SOLUTIONS } from '../data/knownSolutions.js';
/** How similar must code be before we keep a note of the match. */
const MATCH_FLOOR = 0.6;
/**
 * Async similarity worker. Runs in-process against the in-memory queue.
 * Each job:
 *   1. Fingerprints the submission (winnowing) — the expensive part, done
 *      off the request path.
 *   2. Compares against the known-solutions corpus (same problem).
 *   3. Compares against already-fingerprinted submissions from other
 *      participants for the same problem in the same contest.
 *   4. Stores the best similarity + who/what it matched.
 */
export function startSimilarityWorker() {
    registerSimilarityHandler(async ({ submissionId }) => {
        const sub = await Submission.findOne({ submissionId });
        if (!sub)
            return;
        // 1. Fingerprint once.
        if (sub.fingerprint.length === 0) {
            sub.fingerprint = [...fingerprint(sub.code)];
            sub.fingerprintedAt = new Date();
            await sub.save();
        }
        const mine = new Set(sub.fingerprint);
        let best = {
            similarity: 0,
            detail: null,
        };
        // 2. Corpus comparison (same problem slug if available, else all).
        const corpus = KNOWN_SOLUTIONS.filter((s) => !sub.problemSlug || s.problemSlug === sub.problemSlug);
        for (const known of corpus) {
            const sim = overlapCoefficient(mine, fingerprint(known.code));
            if (sim > best.similarity) {
                best = {
                    similarity: sim,
                    detail: { source: 'corpus', other: known.source, problemSlug: known.problemSlug },
                };
            }
        }
        // 3. Participant comparison — everyone else's fingerprint for the same
        //    problem in this contest.
        const others = await Submission.find({
            contestId: sub.contestId,
            problemSlug: sub.problemSlug || { $exists: true },
            _id: { $ne: sub._id },
            fingerprint: { $ne: [] },
        })
            .select('username submissionId fingerprint')
            .lean();
        for (const other of others) {
            const sim = overlapCoefficient(mine, new Set(other.fingerprint));
            if (sim > best.similarity) {
                best = {
                    similarity: sim,
                    detail: {
                        source: 'participant',
                        otherUsername: other.username,
                        otherSubmissionId: other.submissionId,
                        problemSlug: sub.problemSlug,
                    },
                };
            }
        }
        // 4. Persist result.
        if (best.similarity >= MATCH_FLOOR) {
            sub.maxSimilarity = best.similarity;
            sub.matchedAgainst = { ...best.detail, similarity: best.similarity };
            await sub.save();
        }
    });
}
//# sourceMappingURL=similarityWorker.js.map