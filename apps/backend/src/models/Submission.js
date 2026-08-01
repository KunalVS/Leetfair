import mongoose from 'mongoose';
/**
 * A submitted solution with its winnowing fingerprint. Stored so the async
 * similarity worker can compare a new submission against (a) other
 * participants' submissions for the same problem in the same contest and
 * (b) the known-solutions corpus. `maxSimilarity` is the best match found.
 */
const SubmissionSchema = new mongoose.Schema({
    submissionId: { type: String, required: true, unique: true, index: true },
    sessionId: { type: String, required: true, index: true },
    contestId: { type: String, required: true, index: true },
    username: { type: String, required: true, lowercase: true, index: true },
    problemSlug: { type: String, index: true },
    language: { type: String, default: '' },
    status: { type: String, default: '' },
    /** Full source. Shown truncated in the transparency view. */
    code: { type: String, default: '' },
    /** Winnowing fingerprints (uint32 hashes). */
    fingerprint: { type: [Number], default: [] },
    maxSimilarity: { type: Number, default: 0 },
    matchedAgainst: { type: mongoose.Schema.Types.Mixed, default: null },
    fingerprintedAt: { type: Date, default: null },
}, { timestamps: true });
SubmissionSchema.index({ contestId: 1, problemSlug: 1 });
SubmissionSchema.index({ contestId: 1, username: 1 });
export const Submission = mongoose.model('Submission', SubmissionSchema);
//# sourceMappingURL=Submission.js.map