import express from 'express';
import cors from 'cors';
import { eventsRouter } from './routes/events.js';
import { usersRouter } from './routes/users.js';
import { contestsRouter } from './routes/contests.js';
/**
 * LeetFair backend application.
 *
 * The API has three surfaces:
 *   /events/*   — extension ingest (sessions + batched behavioral events)
 *   /users/*    — verification + transparency (self-serve)
 *   /contests/* — contest management + moderated scores
 */
export function createApp() {
    const app = express();
    app.use(cors());
    app.use(express.json({ limit: '2mb' }));
    app.get('/health', (_req, res) => {
        res.json({ ok: true, service: 'leetfair-backend', time: new Date().toISOString() });
    });
    app.use('/', eventsRouter);
    app.use('/', usersRouter);
    app.use('/', contestsRouter);
    // 404 + error handling.
    app.use((_req, res) => {
        res.status(404).json({ error: 'not_found' });
    });
    app.use((err, _req, res, _next) => {
        // eslint-disable-next-line no-console
        console.error('[api] unhandled error:', err);
        res.status(500).json({ error: 'internal_error', message: err.message });
    });
    return app;
}
//# sourceMappingURL=app.js.map