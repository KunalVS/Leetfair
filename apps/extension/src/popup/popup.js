/**
 * Popup logic: username linking, LeetCode-bio verification flow, and a live
 * session status indicator. Talks to the backend directly (the popup is an
 * extension page with host permissions) and to the background worker for
 * session status.
 */

const $ = (id) => document.getElementById(id);

const usernameEl = $('username');
const backendUrlEl = $('backendUrl');
const saveMsg = $('saveMsg');
const tokenEl = $('token');
const verifyMsg = $('verifyMsg');
const statusText = $('statusText');
const statusDot = $('statusDot');

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

async function writeConfig(cfg) {
  await chrome.storage.local.set({ config: cfg });
}

async function ensureHostPermission(backendUrl) {
  try {
    const origin = new URL(backendUrl).origin;
    const pattern = origin + '/*';
    if (await chrome.permissions.contains({ origins: [pattern] })) return true;
    const granted = await chrome.permissions.request({ origins: [pattern] });
    return granted;
  } catch {
    return true; // localhost already covered by host_permissions
  }
}

async function api(path, method = 'POST', body) {
  const cfg = await readConfig();
  const res = await fetch(cfg.backendUrl.replace(/\/$/, '') + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function flash(el, text, kind) {
  el.textContent = text;
  el.className = 'msg' + (kind ? ' ' + kind : '');
}

async function render() {
  const cfg = await readConfig();
  usernameEl.value = cfg.username;
  backendUrlEl.value = cfg.backendUrl;
  void refreshStatus();
}

$('save').addEventListener('click', async () => {
  const username = usernameEl.value.trim();
  const backendUrl = backendUrlEl.value.trim() || 'http://localhost:3000';
  if (!username) {
    flash(saveMsg, 'Enter your LeetCode username.', 'err');
    return;
  }
  if (!(await ensureHostPermission(backendUrl))) {
    flash(saveMsg, 'Host permission was denied; events will not be sent.', 'err');
  }
  await writeConfig({
    username,
    backendUrl,
    linked: true,
    verified: (await readConfig()).verified,
  });
  flash(saveMsg, `Linked as ${username}.`, 'ok');
});

$('verifyStart').addEventListener('click', async () => {
  const username = usernameEl.value.trim();
  if (!username) {
    flash(verifyMsg, 'Enter your username first.', 'err');
    return;
  }
  const { status, data } = await api('/users/verify', 'POST', { username });
  if (status === 200) {
    tokenEl.textContent = data.token ?? '(no token)';
    flash(verifyMsg, 'Copy this token into your LeetCode bio, then check.', 'ok');
  } else {
    flash(verifyMsg, data.error ?? 'Verification could not start.', 'err');
  }
});

$('copyToken').addEventListener('click', async () => {
  const text = tokenEl.textContent ?? '';
  if (text && text !== '—') {
    await navigator.clipboard.writeText(text);
    flash(verifyMsg, 'Token copied.', 'ok');
  }
});

$('verifyCheck').addEventListener('click', async () => {
  const username = usernameEl.value.trim();
  if (!username) {
    flash(verifyMsg, 'Enter your username first.', 'err');
    return;
  }
  const { status, data } = await api('/users/verify/complete', 'POST', { username });
  if (status === 200) {
    if (data.verified) {
      const cfg = await readConfig();
      await writeConfig({ ...cfg, username, verified: true });
      flash(verifyMsg, 'Verified! Your account is linked.', 'ok');
    } else {
      flash(verifyMsg, 'Token not found in bio yet. Double-check and retry.', 'err');
    }
  } else {
    flash(verifyMsg, data.error ?? 'Could not check verification.', 'err');
  }
});

$('refreshStatus').addEventListener('click', () => void refreshStatus());

async function refreshStatus() {
  try {
    const resp = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'LF_STATUS' }, (r) => {
        const err = chrome.runtime.lastError;
        resolve(err ? { ok: false } : r);
      });
    });
    const cfg = await readConfig();
    const active = resp?.ok && resp.status === 'active';
    if (!cfg.linked) {
      statusText.textContent = 'not linked';
      statusDot.className = 'dot';
    } else if (active) {
      statusText.textContent = 'active — sending signals';
      statusDot.className = 'dot active';
    } else {
      statusText.textContent = 'idle — open a contest problem';
      statusDot.className = 'dot';
    }
  } catch {
    statusText.textContent = 'background unavailable';
    statusDot.className = 'dot error';
  }
}

void render();
