import mongoose from 'mongoose';
/**
 * Raw behavioral event ingested from the extension. Stored as a long-lived
 * log so the transparency view can show the participant exactly what was
 * captured. `data` is a free-form object validated on the wire by Zod before
 * it ever reaches here.
 */
const EventSchema = new mongoose.Schema({
    eventId: { type: String, required: true, unique: true, index: true },
    sessionId: { type: String, required: true, index: true },
    contestId: { type: String, required: true, index: true },
    username: { type: String, required: true, lowercase: true, index: true },
    type: {
        type: String,
        required: true,
        enum: [
            'session_started',
            'session_ended',
            'paste',
            'typing',
            'focus_change',
            'devtools_open',
            'devtools_close',
            'time_to_first_submit',
            'submission',
        ],
    },
    ts: { type: Number, required: true },
    problemSlug: { type: String, default: undefined },
    language: { type: String, default: undefined },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });
// Primary query pattern: all events for a participant in a contest.
EventSchema.index({ contestId: 1, username: 1, ts: 1 });
// Secondary: session timeline.
EventSchema.index({ sessionId: 1, ts: 1 });
export const Event = mongoose.model('Event', EventSchema);
//# sourceMappingURL=Event.js.map