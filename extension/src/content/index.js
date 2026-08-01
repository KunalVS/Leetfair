import { installSignals } from './signals.js';

/**
 * Content script. Runs on LeetCode problem / contest pages only.
 *
 * Responsibilities:
 *  - Read the participant config (username / backendUrl / linked) from storage.
 *  - Detect a registered contest from the URL and register a session with the
 *    backend (via the background service worker, which owns network access).
 *  - Capture behavioral signals and ship them to the background worker, which
 *    batches + POSTs every 15s.
 *
 * It deliberately does NOT fetch anything itself: all I/O is delegated to the
 * background worker via chrome.runtime messages.
 */

const CONTENT_FLUSH_MS = 3000; // flush content buffer to background
const CONTENT_FLUSH_MAX = 30; // …or when the buffer gets this big

function readConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get('config', (result) => {
      const cfg = result?.config ?? {};
      resolve({
        username: cfg.username ?? '',
        backendUrl: cfg.backendUrl ?? 'http://localhost:3000',
        linked: Boolean(cfg.linked),
        verified: Boolean(cfg.verified),
      });
    });
  });
}

function send(msg) {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (resp) => {
        const err = chrome.runtime.lastError;
        resolve(err ? { ok: false, error: err.message } : resp);
      });
    } catch (e) {
      resolve({ ok: false, error: e.message });
    }
  });
}

function extractContestSlug(href) {
  const m = href.match(/\/contest\/([^/]+)\//);
  return m ? m[1] : null;
}

function extractProblemSlug(href) {
  const m = href.match(/\/problems\/([^/?#]+)/);
  return m ? m[1] : null;
}

async function main() {
  const config = await readConfig();
  if (!config.linked || !config.username) return; // opt-in: nothing until linked

  const contestSlug = extractContestSlug(window.location.href);
  if (!contestSlug) return; // only contest problem pages are monitored

  // Is this a LeetFair-registered contest?
  const resolved = await send({ type: 'LF_CONTEST_RESOLVE', contestSlug });
  if (!resolved?.ok || !resolved.contestId) return;

  const problemSlug = extractProblemSlug(window.location.href) ?? undefined;

  // Register a session with the backend.
  const started = await send({
    type: 'LF_SESSION_START',
    contestId: resolved.contestId,
    pageUrl: window.location.href,
    problemSlug,
  });
  if (!started?.ok || !started.sessionId) return;

  const sessionId = started.sessionId;
  const buffer = [];
  let flushTimer;

  const emit = (type, data, extra) => {
    buffer.push({
      type,
      ts: Date.now(),
      sessionId,
      username: config.username,
      problemSlug: extra?.problemSlug ?? problemSlug,
      data,
    });
    if (buffer.length >= CONTENT_FLUSH_MAX) flushToBackground('interval');
  };

  const flushToBackground = (reason) => {
    if (buffer.length > 0) {
      const events = buffer.splice(0, buffer.length);
      void send({ type: 'LF_EVENT', events, reason });
    } else if (reason === 'session_end') {
      void send({ type: 'LF_FLUSH', reason });
    }
  };

  flushTimer = window.setInterval(() => flushToBackground('interval'), CONTENT_FLUSH_MS);

  const { stats, cleanup } = installSignals({
    sessionId,
    username: config.username,
    problemSlug,
    emit,
  });

  // Contest/page end: report session end best-effort and flush everything.
  const onPageHide = () => {
    window.clearInterval(flushTimer);
    emit('session_ended', {
      durationMs: Date.now() - stats.sessionStartTs,
      submissionCount: stats.submissionCount,
    });
    flushToBackground('session_end');
    cleanup();
  };
  window.addEventListener('pagehide', onPageHide);
}

void main();
