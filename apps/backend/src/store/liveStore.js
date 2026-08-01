/**
 * In-memory store for volatile "live session" state.
 *
 * Replaces Redis for local/dev runs (no Docker needed). Lives and dies with
 * the backend process, so it's suitable for a contest that runs while the
 * server is up. MongoDB remains the system of record; this is only for the
 * dashboard's "who is live right now" view.
 *
 * If you later want multi-instance deployments, swap this for a real Redis
 * implementation — the service layer (src/services/liveState.ts) is the only
 * consumer, so the change is contained.
 */
const entries = new Map(); // key: leetfair:live:<contestId>:<username>
const sets = new Map(); // key: leetfair:live:<contestId> -> usernames
function purge(contestId) {
    const now = Date.now();
    const prefix = `leetfair:live:${contestId}:`;
    for (const [key, entry] of entries) {
        if (key.startsWith(prefix) && entry.expiresAt < now) {
            entries.delete(key);
            sets.get(`leetfair:live:${contestId}`)?.delete(key.slice(prefix.length));
        }
    }
}
export function markActive(contestId, username, sessionId, ttlMs) {
    const now = Date.now();
    const setKey = `leetfair:live:${contestId}`;
    if (!sets.has(setKey))
        sets.set(setKey, new Set());
    sets.get(setKey).add(username);
    entries.set(`leetfair:live:${contestId}:${username}`, {
        sessionId,
        active: true,
        seenAt: now,
        expiresAt: now + ttlMs,
    });
}
export function touch(contestId, username, ttlMs) {
    const key = `leetfair:live:${contestId}:${username}`;
    const entry = entries.get(key);
    if (entry)
        entry.expiresAt = Date.now() + ttlMs;
}
export function clearContest(contestId) {
    const setKey = `leetfair:live:${contestId}`;
    purge(contestId);
    const members = sets.get(setKey);
    if (members) {
        for (const u of members)
            entries.delete(`leetfair:live:${contestId}:${u}`);
    }
    sets.delete(setKey);
}
/** Live participant states keyed by username, ready for JSON responses. */
export function getLive(contestId) {
    purge(contestId);
    const setKey = `leetfair:live:${contestId}`;
    const members = sets.get(setKey);
    if (!members)
        return {};
    const out = {};
    for (const u of members) {
        const entry = entries.get(`leetfair:live:${contestId}:${u}`);
        if (entry)
            out[u] = entry;
    }
    return out;
}
//# sourceMappingURL=liveStore.js.map