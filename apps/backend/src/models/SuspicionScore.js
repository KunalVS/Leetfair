import mongoose from 'mongoose';
/**
 * A stored suspicion score for one participant in one contest. Written by the
 * post-contest aggregation job. `zScores` mirrors the per-signal values shown
 * in the transparency view; `signalStats` is the underlying raw summary.
 */
const SuspicionScoreSchema = new mongoose.Schema({
    contestId: { type: String, required: true, index: true },
    username: { type: String, required: true, lowercase: true, index: true },
    /** Final triage score, 0..100. */
    score: { type: Number, required: true },
    /** Per-signal z-scores used to compute `score`. */
    zScores: { type: mongoose.Schema.Types.Mixed, default: {} },
    /** Raw per-signal metrics for this participant. */
    signalStats: { type: mongoose.Schema.Types.Mixed, default: {} },
    /** Moderator follow-up state — triage only, never auto-decided. */
    reviewStatus: {
        type: String,
        enum: ['unreviewed', 'under_review', 'cleared', 'confirmed'],
        default: 'unreviewed',
    },
    reviewNote: { type: String, default: '' },
    computedAt: { type: Date, required: true },
}, { timestamps: true });
SuspicionScoreSchema.index({ contestId: 1, username: 1 }, { unique: true });
SuspicionScoreSchema.index({ contestId: 1, score: -1 });
export const SuspicionScore = mongoose.model('SuspicionScore', SuspicionScoreSchema);
//# sourceMappingURL=SuspicionScore.js.map