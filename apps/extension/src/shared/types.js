/**
 * Message protocol constants shared between the content script, the
 * background service worker and the popup.
 *
 * The content script only *captures* and *reports*. All network I/O happens in
 * the background service worker (which holds host permissions), so the content
 * script never needs to touch CORS or raw fetch.
 */

export const DEFAULT_BACKEND_URL = 'http://localhost:3000';
