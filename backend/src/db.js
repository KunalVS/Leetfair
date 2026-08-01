import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { env } from './config/index.js';
/**
 * Database connection with a zero-setup dev path.
 *
 * - If `MONGODB_URI` is set, connect to that external MongoDB (a real
 *   install or a hosted cluster — no Docker required either way).
 * - If it's empty (default), spin up an in-memory MongoDB
 *   (mongodb-memory-server). Everything works, nothing is installed, and
 *   data resets when the process exits — ideal for local dev/demo.
 */
let memoryServer = null;
export async function connectDatabase() {
    let uri = env.MONGODB_URI;
    if (!uri) {
        memoryServer = await MongoMemoryServer.create();
        uri = memoryServer.getUri('leetfair');
        // eslint-disable-next-line no-console
        console.log('[db] using in-memory MongoDB (data resets on restart)');
    }
    await mongoose.connect(uri);
    return uri;
}
export async function disconnectDatabase() {
    await mongoose.disconnect().catch(() => undefined);
    if (memoryServer) {
        await memoryServer.stop();
        memoryServer = null;
    }
}
//# sourceMappingURL=db.js.map