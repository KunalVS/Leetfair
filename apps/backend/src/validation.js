import { z } from 'zod';
/**
 * Wire-format validation for everything the extension sends. We validate
 * per-event and drop malformed events rather than failing a whole batch —
 * a network hiccup should never lose an entire session.
 */
const base = z.object({
    type: z.enum([
        'session_started',
        'session_ended',
        'paste',
        'typing',
        'focus_change',
        'devtools_open',
        'devtools_close',
        'time_to_first_submit',
        'submission',
    ]),
    ts: z.number().nonnegative(),
    sessionId: z.string().min(1),
    username: z.string().min(1).max(64),
    problemSlug: z.string().optional(),
    language: z.string().optional(),
    // Payload validated by type in the superRefine below; kept loose here so the
    // refined type is `Record<string, unknown>` and use-sites narrow it.
    data: z.record(z.string(), z.unknown()),
});
const dataByType = {
    session_started: z.object({ contestId: z.string().min(1), pageUrl: z.string().optional() }),
    session_ended: z.object({
        durationMs: z.number().nonnegative(),
        submissionCount: z.number().nonnegative().optional(),
    }),
    paste: z.object({
        size: z.number().nonnegative(),
        totalSessionBytes: z.number().nonnegative().optional(),
    }),
    typing: z.object({
        intervalMeanMs: z.number().nonnegative(),
        intervalStdDevMs: z.number().nonnegative(),
        keyCount: z.number().nonnegative().optional(),
        totalTyped: z.number().nonnegative().optional(),
    }),
    focus_change: z.object({
        state: z.enum(['hidden', 'visible', 'blur', 'focus']),
        durationMs: z.number().nonnegative().optional(),
        totalFocusLossMs: z.number().nonnegative().optional(),
        sessionMs: z.number().nonnegative().optional(),
    }),
    devtools_open: z.object({
        open: z.boolean(),
        totalOpenMs: z.number().nonnegative().optional(),
        sessionMs: z.number().nonnegative().optional(),
    }),
    devtools_close: z.object({
        open: z.boolean(),
        totalOpenMs: z.number().nonnegative().optional(),
        sessionMs: z.number().nonnegative().optional(),
    }),
    time_to_first_submit: z.object({ seconds: z.number().nonnegative() }),
    submission: z.object({
        status: z.string().optional(),
        code: z.string(),
        firstSubmission: z.boolean().optional(),
    }),
};
export const BehavioralEventSchema = base.superRefine((val, ctx) => {
    const dataSchema = dataByType[val.type];
    if (!dataSchema) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'unknown event type' });
        return;
    }
    const parsed = dataSchema.safeParse(val.data);
    if (!parsed.success) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid data payload' });
    }
});
export const EventBatchSchema = z.object({
    events: z.array(BehavioralEventSchema).max(500),
});
export const StartSessionSchema = z.object({
    contestId: z.string().min(1),
    username: z.string().min(1).max(64),
    pageUrl: z.string().optional(),
    problemSlug: z.string().optional(),
});
export const VerifyStartSchema = z.object({ username: z.string().min(1).max(64) });
export const VerifyCompleteSchema = z.object({ username: z.string().min(1).max(64) });
export const CreateContestSchema = z.object({
    name: z.string().min(1).max(200),
    slug: z.string().optional(),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    createdBy: z.string().min(1).max(64),
    problemSlugs: z.array(z.string()).optional(),
});
//# sourceMappingURL=validation.js.map