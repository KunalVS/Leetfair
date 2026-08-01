/**
 * Background service worker.
 *
 * Owns all network access (host permissions). Receives captured events from
 * the content script, buffers them, and POSTs a batch to the backend every
 * 15s via a chrome.alarms interval — plus an immediate flush when a session
 * ends or the popup asks.
 */

const FLUSH_INTERVAL_MINUTES = 0.25; // 15s
const ALARM_NAME = 'leetfair-flush';
const MAX_BUFFER = 5000; // safety cap; drop oldest beyond this

// ── config / storage helpers ───────────────────────────────────────────────

function getConfig() {
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

function loadBuffer() {
  return new Promise((resolve) => {
    chrome.storage.session.get('buffer', (result) => {
      resolve(Array.isArray(result?.buffer) ? result.buffer : []);
    });
  });
}

async function saveBuffer(events) {
  const trimmed = events.slice(-MAX_BUFFER);
  await chrome.storage.session.set({ buffer: trimmed });
}

async function pushEvents(events) {
  const buffer = await loadBuffer();
  await saveBuffer([...buffer, ...events]);
}

// ── network ────────────────────────────────────────────────────────────────

async function api(path, init) {
  const cfg = await getConfig();
  const url = cfg.backendUrl.replace(/\/$/, '') + path;
  const headers = { 'Content-Type': 'application/json', ...(init?.headers ?? {}) };
  return fetch(url, { ...init, headers });
}

/** POST buffered events to the backend. Keeps the buffer on failure. */
export async function flush(reason) {
  const buffer = await loadBuffer();
  if (buffer.length === 0) return { ok: true, count: 0 };
  try {
    const res = await api('/events/batch', {
      method: 'POST',
      body: JSON.stringify({ events: buffer }),
    });
    if (res.ok) {
      await saveBuffer([]);
      return { ok: true, count: buffer.length };
    }
    console.warn('[leetfair] flush failed', res.status, await res.text());
    return { ok: false };
  } catch (err) {
    console.warn('[leetfair] flush network error', err);
    return { ok: false };
  }
}

// ── message handling ───────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  void handleMessage(msg).then(sendResponse);
  return true; // keep the channel open for the async response
});

async function handleMessage(msg) {
  switch (msg.type) {
    case 'LF_CONTEST_RESOLVE': {
      try {
        const res = await api(`/contests/by-slug/${encodeURIComponent(msg.contestSlug)}`);
        if (!res.ok) return { ok: false, error: `contest_not_found (${res.status})` };
        const contest = await res.json();
        return { ok: true, contestId: contest._id };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    }

    case 'LF_SESSION_START': {
      try {
        const cfg = await getConfig();
        const res = await api('/sessions/start', {
          method: 'POST',
          body: JSON.stringify({
            contestId: msg.contestId,
            username: cfg.username,
            pageUrl: msg.pageUrl,
            problemSlug: msg.problemSlug,
          }),
        });
        if (!res.ok) return { ok: false, error: `session_start_failed (${res.status})` };
        const body = await res.json();
        return { ok: true, sessionId: body.sessionId };
      } catch (err) {
        return { ok: false, error: err.message };
      }
    }

    case 'LF_EVENT': {
      await pushEvents(msg.events);
      return { ok: true };
    }

    case 'LF_FLUSH': {
      const result = await flush(msg.reason);
      return result.ok ? { ok: true } : { ok: false, error: 'flush_failed' };
    }

    case 'LF_STATUS': {
      const buffer = await loadBuffer();
      return {
        ok: true,
        status: buffer.length > 0 ? 'active' : 'inactive',
      };
    }

    default:
      return { ok: false, error: 'unknown_message' };
  }
}

// ── alarms ─────────────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) void flush('interval');
});

async function ensureFlushAlarm() {
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (!existing) {
    chrome.alarms.create(ALARM_NAME, { periodInMinutes: FLUSH_INTERVAL_MINUTES });
  }
}

chrome.runtime.onStartup.addListener(() => void ensureFlushAlarm());
chrome.runtime.onInstalled.addListener(() => void ensureFlushAlarm());

// ── config change → restart alarms/buffer ──────────────────────────────────

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.config) {
    void ensureFlushAlarm();
  }
});
