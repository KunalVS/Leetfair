import crypto from 'node:crypto';
import { env } from '../config/index.js';
import { User } from '../models/User.js';
/**
 * Lightweight ownership check.
 *
 * Flow:
 *   1. `startVerification(username)` issues a unique token like
 *      `LEETFAIR-8f3a...`.
 *   2. The participant pastes that token into their LeetCode profile bio
 *      (About/Summary section).
 *   3. `completeVerification(username)` fetches the participant's public
 *      LeetCode profile page and looks for the token string.
 *
 * This is best-effort: LeetCode's public page shape can change, so a false
 * negative just means "couldn't confirm", not "cheater". A false positive is
 * nearly impossible because the token is unique per user and time-boxed.
 */
/** Generate a fresh verification token. */
export function generateVerificationToken() {
    return `${env.LEETFAIR_VERIFY_PREFIX}-${crypto.randomBytes(8).toString('hex')}`;
}
/** Fetch the raw public profile HTML for a LeetCode username. */
async function fetchPublicProfileHtml(username) {
    const url = `https://leetcode.com/u/${encodeURIComponent(username)}/`;
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'LeetFair/0.1 (opt-in contest integrity check)',
            Accept: 'text/html',
        },
    });
    if (!res.ok) {
        throw new Error(`LeetCode profile fetch failed (${res.status}) for ${username}`);
    }
    return res.text();
}
/**
 * Start verification: generate a token for the user to place in their bio.
 * Returns the token to display to the participant.
 */
export async function startVerification(username) {
    const user = await User.findOneAndUpdate({ username: username.toLowerCase() }, { $set: { username: username.toLowerCase(), 'verification.token': null } }, { upsert: true, new: true });
    const token = generateVerificationToken();
    if (!user.verification) {
        user.verification = { token: null, verifiedAt: null, bioCheckedAt: null };
    }
    user.verification.token = token;
    await user.save();
    return token;
}
/**
 * Complete verification: check the participant's public profile bio for the
 * token. Returns the current verification state after the attempt.
 */
export async function completeVerification(username) {
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user?.verification?.token) {
        return { verified: false, bioCheckedAt: null };
    }
    const token = user.verification.token;
    let html;
    try {
        html = await fetchPublicProfileHtml(username);
    }
    catch (err) {
        // Treat fetch failures as "could not check" — never as a positive.
        return { verified: false, bioCheckedAt: new Date() };
    }
    const found = html.includes(token);
    user.verification.bioCheckedAt = new Date();
    if (found) {
        user.verification.verifiedAt = new Date();
        user.verification.token = token; // keep token so re-checks can pass
    }
    await user.save();
    return {
        verified: found,
        bioCheckedAt: user.verification.bioCheckedAt,
    };
}
/** Whether a user has a completed, confirmed verification. */
export async function isVerified(username) {
    const user = await User.findOne({ username: username.toLowerCase() });
    return Boolean(user?.verification?.verifiedAt);
}
//# sourceMappingURL=verification.js.map