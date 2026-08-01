import { env } from '../config/index.js';
import * as liveStore from '../store/liveStore.js';
/**
 * Live-session bookkeeping. Currently backed by an in-memory store (no Redis
 * required). Swap `liveStore` for a Redis-backed module to scale to multiple
 * backend instances — nothing else changes.
 */
const TTL_MS = env.SESSION_TTL_SECONDS * 1000;
export async function markSessionActive(contestId, username, sessionId) {
    liveStore.markActive(contestId, username, sessionId, TTL_MS);
}
export async function touchSession(contestId, username) {
    liveStore.touch(contestId, username, TTL_MS);
}
export async function clearContestLiveState(contestId) {
    liveStore.clearContest(contestId);
}
export async function getLiveParticipants(contestId) {
    return liveStore.getLive(contestId);
}
//# sourceMappingURL=liveState.js.map