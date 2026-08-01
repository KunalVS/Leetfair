import dotenv from 'dotenv';
import { z } from 'zod';
dotenv.config();
const EnvSchema = z.object({
    PORT: z.coerce.number().default(3000),
    /** Empty (default) = in-memory MongoDB. Set to a connection string to use an external Mongo. */
    MONGODB_URI: z.string().default(''),
    LEETFAIR_VERIFY_PREFIX: z.string().default('LEETFAIR'),
    MODERATOR_USERNAMES: z.string().default(''),
    SESSION_TTL_SECONDS: z.coerce.number().default(60 * 60 * 24 * 7),
    /** Require completed LeetCode-bio verification before a session can start. */
    REQUIRE_VERIFICATION: z
        .string()
        .transform((v) => !['0', 'false', 'no', ''].includes(v.toLowerCase()))
        .default('true'),
    /** Seed demo data (contest + participants + scores) at boot. */
    SEED_DEMO: z
        .string()
        .transform((v) => ['1', 'true', 'yes', 'on'].includes(v.toLowerCase()))
        .default('false'),
});
const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.error('Invalid environment configuration:', parsed.error.flatten());
    process.exit(1);
}
export const env = parsed.data;
/** Usernames (lowercased) allowed to create contests and view moderation data. */
export const moderatorUsernames = new Set(env.MODERATOR_USERNAMES.split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean));
export function isModerator(username) {
    if (!username)
        return false;
    if (moderatorUsernames.size === 0)
        return true; // open mode for private leagues
    return moderatorUsernames.has(username.toLowerCase());
}
//# sourceMappingURL=index.js.map