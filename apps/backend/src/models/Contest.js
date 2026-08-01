import mongoose from 'mongoose';
/** A contest created by a community organizer. */
const ContestSchema = new mongoose.Schema({
    name: { type: String, required: true },
    slug: { type: String, index: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    createdBy: { type: String, required: true },
    /** Optional: list of LeetCode problem slugs included in this contest. */
    problemSlugs: { type: [String], default: [] },
    /** Set when the post-contest aggregation job has completed for this contest. */
    aggregatedAt: { type: Date, default: null },
}, { timestamps: true });
ContestSchema.index({ startAt: 1, endAt: 1 });
export const Contest = mongoose.model('Contest', ContestSchema);
//# sourceMappingURL=Contest.js.map