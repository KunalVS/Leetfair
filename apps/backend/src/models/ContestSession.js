import mongoose from 'mongoose';
/**
 * One extension instance's session for a contest. Created when the content
 * script first detects a registered contest and calls the backend to start a
 * session; closed on contest end (or when the extension sends session_ended).
 */
const ContestSessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true, index: true },
    contestId: { type: String, required: true, index: true },
    username: { type: String, required: true, lowercase: true, index: true },
    status: { type: String, enum: ['active', 'closed'], default: 'active' },
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, default: null },
    durationMs: { type: Number, default: 0 },
    submissionCount: { type: Number, default: 0 },
    problemSlugs: { type: [String], default: [] },
    lastSeenAt: { type: Date, default: null },
}, { timestamps: true });
ContestSessionSchema.index({ contestId: 1, username: 1 });
export const ContestSession = mongoose.model('ContestSession', ContestSessionSchema);
//# sourceMappingURL=ContestSession.js.map