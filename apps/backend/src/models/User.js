import mongoose from 'mongoose';
/**
 * A verified participant. Verification is lightweight ownership proof: the
 * user pastes a token into their LeetCode profile bio and the backend confirms
 * it via the public profile. It exists so event payloads can't be spoofed by
 * just claiming a username.
 */
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, lowercase: true, index: true },
    verification: {
        token: { type: String, default: null },
        verifiedAt: { type: Date, default: null },
        bioCheckedAt: { type: Date, default: null },
    },
}, { timestamps: true });
export const User = mongoose.model('User', UserSchema);
//# sourceMappingURL=User.js.map