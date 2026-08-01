import { SIGNALS } from '../config/scoring.js';
/**
 * Reduce a participant's raw events into per-signal metrics.
 *
 * `focusLossFraction` / `devtoolsOpenFraction` are always present (0 when no
 * events observed); the rest are absent when the participant produced no data
 * for them, so they never distort the cohort mean.
 */
export function summarizeEvents(events, submissions) {
    const out = {};
    // Session wall-clock for ratio computations.
    const started = events.find((e) => e.type === 'session_started');
    const ended = events.find((e) => e.type === 'session_ended');
    const firstTs = events.length ? events[0].ts : undefined;
    const lastTs = events.length ? events[events.length - 1].ts : undefined;
    const durationMs = ended && typeof ended.data.durationMs === 'number' && ended.data.durationMs > 0
        ? ended.data.durationMs
        : firstTs && lastTs
            ? Math.max(0, lastTs - firstTs)
            : 0;
    // Paste signals.
    const pasteEvents = events.filter((e) => e.type === 'paste');
    if (pasteEvents.length > 0) {
        out.pasteBytes = pasteEvents.reduce((sum, e) => sum + (typeof e.data.size === 'number' ? e.data.size : 0), 0);
        out.pasteCount = pasteEvents.length;
    }
    // Typing cadence: average the burst means and burst std-devs.
    const typingEvents = events.filter((e) => e.type === 'typing');
    if (typingEvents.length > 0) {
        const means = typingEvents
            .map((e) => e.data.intervalMeanMs)
            .filter((v) => typeof v === 'number');
        const stds = typingEvents
            .map((e) => e.data.intervalStdDevMs)
            .filter((v) => typeof v === 'number');
        if (means.length) {
            out.typingMeanMs = means.reduce((a, b) => a + b, 0) / means.length;
        }
        if (stds.length) {
            out.typingStdDevMs = stds.reduce((a, b) => a + b, 0) / stds.length;
        }
    }
    // Focus loss fraction.
    const focusTotal = events
        .filter((e) => e.type === 'focus_change')
        .reduce((sum, e) => sum + (typeof e.data.durationMs === 'number' ? e.data.durationMs : 0), 0);
    out.focusLossFraction = durationMs > 0 ? focusTotal / durationMs : 0;
    // DevTools open fraction. The extension reports a *cumulative* totalOpenMs
    // on every open/close event, so the last (max) value is the authoritative
    // running total — summing them would double-count.
    const devtoolsTotals = events
        .filter((e) => e.type === 'devtools_open' || e.type === 'devtools_close')
        .map((e) => e.data.totalOpenMs)
        .filter((v) => typeof v === 'number');
    const devtoolsOpenMs = devtoolsTotals.length ? Math.max(...devtoolsTotals) : 0;
    out.devtoolsOpenFraction = durationMs > 0 ? devtoolsOpenMs / durationMs : 0;
    // Time to first submit.
    const ttf = events.find((e) => e.type === 'time_to_first_submit');
    if (ttf && typeof ttf.data.seconds === 'number') {
        out.timeToFirstSubmitSec = ttf.data.seconds;
    }
    // Code similarity: the best (max) similarity across the user's submissions,
    // as recorded by the similarity worker.
    if (submissions.length > 0) {
        out.codeSimilarity = Math.max(...submissions.map((s) => s.maxSimilarity ?? 0));
    }
    return out;
}
/**
 * Compute per-signal cohort statistics (mean/stdDev) over a list of summaries,
 * ignoring participants with no data for that signal. This is the heart of the
 * "relative to the cohort" normalization.
 */
export function computeCohortStats(summaries) {
    const cohort = {};
    for (const name of Object.keys(SIGNALS)) {
        const values = summaries
            .map((s) => s[name])
            .filter((v) => typeof v === 'number');
        if (values.length === 0)
            continue;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
        const stdDev = Math.sqrt(variance);
        cohort[name] = { mean, stdDev, sampleCount: values.length };
    }
    return cohort;
}
export { computeSignalZ, combineScores, SIGNALS } from '../config/scoring.js';
//# sourceMappingURL=scoringService.js.map