/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  LeetFair scoring configuration.
 *
 *  THIS IS THE ONLY FILE YOU NEED TO TOUCH TO TUNE THE SUSPICION FORMULA.
 *
 *  The pipeline is:
 *    1. Each participant's session is summarized into a handful of per-signal
 *       metrics (see `SignalStats` below).
 *    2. For each contest cohort, every metric is z-score normalized:
 *           z = (x - cohortMean) / cohortStdDev
 *       so that a value 2 standard deviations above the cohort's average is a
 *       strong relative signal, regardless of the contest's absolute level.
 *    3. A weighted sum of (per-signal z-scores, with each z capped/trimmed)
 *       is squashed to a 0..100 "suspicion score".
 *
 *  IMPORTANT DESIGN DECISIONS
 *  ──────────────────────────
 *  * A suspicion score is a TRIAGE RANKING for human review. It is not a
 *    verdict. No signal alone is damning; we only surface who is most worth a
 *    moderator's time.
 *  * Direction matters per signal: for some signals a LOW z-score is the
 *    anomaly (e.g. typing cadence that is TOO consistent), for others a HIGH
 *    z-score is (paste volume, focus loss). This is encoded in `direction`.
 *  * Weights are relative. Only the ratio between them matters; they are
 *    normalized internally. Sum = 1.0 is a nicety for readability.
 *  * Everything below is easy to explain to a flagged participant — the
 *    transparency view literally renders these per-signal z-scores.
 * ─────────────────────────────────────────────────────────────────────────────
 */
/**
 * ── SIGNAL WEIGHTS (TUNE HERE) ──────────────────────────────────────────────
 * Rationale for defaults:
 *  - pasteBytes / pasteCount: pasting a solution is the single most direct
 *    cheat vector in competitive coding. Highest combined weight.
 *  - codeSimilarity: winnowing overlap vs other participants & known
 *    solutions. Very strong, but similarity can have false positives (shared
 *    boilerplate, obvious canonical solutions), so we don't max it out.
 *  - typingStdDevMs (robotic regularity) and typingMeanMs (implausibly fast)
 *    catch "played back" solutions. Independent of paste.
 *  - timeToFirstSubmitSec: instant solutions are suspicious but "fast" is not
 *    proof; moderate weight, mean-centered.
 *  - focusLossFraction / devtoolsOpenFraction: classic looking-things-up
 *    behavior; real, but common among honest-but-distracted participants.
 * ────────────────────────────────────────────────────────────────────────────
 */
export const SIGNALS = {
    pasteBytes: {
        label: 'Total bytes pasted',
        direction: 1,
        weight: 1.6,
        maxZ: 3.5,
        nullable: true,
        transform: (x) => Math.log1p(x), // log-shrink right-skewed byte counts
    },
    pasteCount: {
        label: 'Paste events',
        direction: 1,
        weight: 1.2,
        maxZ: 3.5,
        nullable: true,
    },
    typingMeanMs: {
        label: 'Mean keystroke interval',
        direction: -1, // implausibly fast typing is the anomaly
        weight: 0.8,
        maxZ: 3.0,
        nullable: true,
    },
    typingStdDevMs: {
        label: 'Keystroke interval regularity',
        direction: -1, // perfectly regular typing is the anomaly
        weight: 1.0,
        maxZ: 3.0,
        nullable: true,
    },
    focusLossFraction: {
        label: 'Focus loss fraction',
        direction: 1,
        weight: 0.7,
        maxZ: 3.0,
        nullable: false,
    },
    devtoolsOpenFraction: {
        label: 'DevTools open fraction',
        direction: 1,
        weight: 0.5,
        maxZ: 3.0,
        nullable: false,
    },
    timeToFirstSubmitSec: {
        label: 'Time to first submit (s)',
        direction: 1, // abnormally instant is suspicious; we treat low as normal
        weight: 0.6,
        maxZ: 3.0,
        nullable: true,
        transform: (x) => -Math.log1p(x), // log so "instant" maps to a high z
    },
    codeSimilarity: {
        label: 'Best code similarity match',
        direction: 1,
        weight: 1.4,
        maxZ: 3.5,
        nullable: true,
    },
};
export const TOTAL_WEIGHT = Object.values(SIGNALS).reduce((s, x) => s + x.weight, 0);
/** Normalized weight for a signal (weights sum to 1.0). */
export function normWeight(name) {
    return SIGNALS[name].weight / TOTAL_WEIGHT;
}
/**
 * Compute a per-signal z-score for one participant given the cohort stats.
 *
 * z = direction * clamp((value - mean) / stdDev, -maxZ, maxZ)
 *
 * If the cohort's stdDev is 0 the signal carries no relative information and
 * contributes 0 (it would be a constant for everyone anyway). If a nullable
 * signal has no data, it contributes 0 rather than punishing/rewarding.
 */
export function computeSignalZ(name, value, cohort) {
    const spec = SIGNALS[name];
    if (value === undefined || value === null || !cohort || cohort.stdDev === 0)
        return 0;
    const raw = spec.transform ? spec.transform(value) : value;
    const z = (raw - cohort.mean) / cohort.stdDev;
    const clamped = Math.max(-spec.maxZ, Math.min(spec.maxZ, z));
    return spec.direction * clamped;
}
/**
 * Combine per-signal z-scores into the final 0..100 suspicion score.
 *
 *   raw    = Σ (normalizedWeight * z)
 *   score  = 100 / (1 + e^(-raw))        <- logistic squashing
 *
 * The logistic map keeps scores interpretable: z=0 => 50, z≈+3 => ~95,
 * z≈-3 => ~5. Because weights are normalized and z's are clamped, the score
 * is bounded and stable across contests.
 */
export function combineScores(zs) {
    const raw = Object.keys(zs).reduce((acc, name) => acc + normWeight(name) * (zs[name] ?? 0), 0);
    const clamped = Math.max(-4, Math.min(4, raw));
    return Math.round((100 / (1 + Math.exp(-clamped))) * 100) / 100;
}
/** Default suspicion score when no behavioral data exists yet. */
export const NEUTRAL_SCORE = combineScores({});
//# sourceMappingURL=scoring.js.map