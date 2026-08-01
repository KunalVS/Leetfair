import { Redis } from 'ioredis';
import { env } from '../config/index.js';
/**
 * Redis holds volatile "live session" state during an active contest:
 *   leetfair:live:<contestId>:<username> -> JSON session heartbeat
 *   leetfair:live:<contestId>            -> set of active usernames
 * Nothing security-critical lives here; MongoDB is the system of record.
 */
export const redis = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    maxRetriesPerRequest: null, // required by BullMQ
    lazyConnect: true,
});
export async function connectRedis() {
    await redis.connect();
}
export function liveKey(contestId, username) {
    return `leetfair:live:${contestId}:${username}`;
}
export function liveSetKey(contestId) {
    return `leetfair:live:${contestId}`;
}
//# sourceMappingURL=client.js.map