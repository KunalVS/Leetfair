/**
 * Signal capture. Each signal is a weak, noisy indicator by itself; the
 * backend normalizes them against the whole contest cohort.
 *
 * Deliberate design choices:
 *  - We record *metrics* (timestamps, sizes, intervals), never clipboard text
 *    contents and never anything outside the code editor.
 *  - The DevTools check is the well-known resize heuristic. It is best-effort
 *    and can be fooled; treat it as a soft signal, never as proof.
 */

/** True when the event target is inside LeetCode's code editor. */
function isInEditor(target) {
  const el = target;
  if (!el) return false;
  return Boolean(
    el.closest(
      '.monaco-editor, .CodeMirror, .react-monaco-editor-container, .editor-container, .inputarea',
    ),
  );
}

/** Best-effort extraction of the current editor source. */
function getEditorCode() {
  try {
    const w = window;
    const models = w.monaco?.editor?.getModels?.();
    if (models && models.length > 0) {
      return models.map((m) => m.getValue()).join('\n');
    }
  } catch {
    /* ignore */
  }
  const ta = document.querySelector(
    'textarea.inputarea, .monaco-editor textarea, textarea',
  );
  return ta ? ta.value : '';
}

/**
 * Install all signal listeners. Returns a stats handle (for session_ended)
 * and a cleanup function.
 */
export function installSignals(env) {
  const stats = {
    totalPasted: 0,
    totalTyped: 0,
    totalFocusLossMs: 0,
    totalDevtoolsMs: 0,
    sessionStartTs: Date.now(),
    firstSubmitAt: null,
    submissionCount: 0,
  };

  const cleanups = [];

  // ── Paste ────────────────────────────────────────────────────────────────
  const onPaste = (e) => {
    if (!isInEditor(e.target)) return;
    const text = e.clipboardData?.getData('text/plain') ?? '';
    stats.totalPasted += text.length;
    env.emit('paste', { size: text.length, totalSessionBytes: stats.totalPasted });
  };
  document.addEventListener('paste', onPaste, true);
  cleanups.push(() => document.removeEventListener('paste', onPaste, true));

  // ── Typing cadence ────────────────────────────────────────────────────────
  const TYPING_BURST_LIMIT = 50; // emit a burst every ~50 keystrokes
  const TYPING_BURST_MS = 5000; // or every 5s, whichever first
  let lastKeyTs = 0;
  let burstIntervals = [];
  let burstKeys = 0;
  let burstStarted = 0;

  const flushTypingBurst = () => {
    if (burstKeys === 0) return;
    const mean = burstIntervals.reduce((a, b) => a + b, 0) / Math.max(1, burstIntervals.length);
    const variance =
      burstIntervals.reduce((acc, v) => acc + (v - mean) ** 2, 0) /
      Math.max(1, burstIntervals.length);
    env.emit('typing', {
      intervalMeanMs: Math.round(mean),
      intervalStdDevMs: Math.round(Math.sqrt(variance)),
      keyCount: burstKeys,
      totalTyped: stats.totalTyped,
    });
    burstIntervals = [];
    burstKeys = 0;
    burstStarted = 0;
  };

  const onKeyDown = (e) => {
    if (!isInEditor(e.target)) return;
    // Count editing-ish keys: printable chars, space, backspace, enter, delete.
    if (e.key.length === 1 || ['Backspace', 'Enter', 'Delete', 'Tab'].includes(e.key)) {
      const now = Date.now();
      if (lastKeyTs > 0) {
        const interval = now - lastKeyTs;
        if (interval > 0 && interval < 10_000) {
          burstIntervals.push(interval);
          burstKeys++;
          stats.totalTyped++;
        }
      }
      lastKeyTs = now;
      if (burstStarted === 0) burstStarted = now;
      if (
        burstKeys >= TYPING_BURST_LIMIT ||
        (burstStarted && now - burstStarted >= TYPING_BURST_MS)
      ) {
        flushTypingBurst();
      }
    }
  };
  document.addEventListener('keydown', onKeyDown, true);
  cleanups.push(() => document.removeEventListener('keydown', onKeyDown, true));
  cleanups.push(() => flushTypingBurst());

  // ── Focus loss (visibilitychange + blur/focus) ────────────────────────────
  let focusLossStart = null;

  const recordFocusLoss = (state) => {
    if (focusLossStart !== null) return;
    focusLossStart = Date.now();
    env.emit('focus_change', {
      state,
      totalFocusLossMs: stats.totalFocusLossMs,
      sessionMs: Date.now() - stats.sessionStartTs,
    });
  };

  const recordFocusGain = (state) => {
    if (focusLossStart === null) return;
    const durationMs = Date.now() - focusLossStart;
    focusLossStart = null;
    stats.totalFocusLossMs += durationMs;
    env.emit('focus_change', {
      state,
      durationMs,
      totalFocusLossMs: stats.totalFocusLossMs,
      sessionMs: Date.now() - stats.sessionStartTs,
    });
  };

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') recordFocusLoss('hidden');
    else recordFocusGain('visible');
  };
  const onBlur = () => recordFocusLoss('blur');
  const onFocus = () => recordFocusGain('focus');

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);
  cleanups.push(() => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('blur', onBlur);
    window.removeEventListener('focus', onFocus);
  });

  // ── DevTools open (resize heuristic — soft signal, best-effort) ───────────
  const DEVTOOLS_THRESHOLD = 160;
  let devtoolsOpen = false;
  let devtoolsOpenStart = 0;

  const detectDevTools = () => {
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    const open = widthDiff > DEVTOOLS_THRESHOLD || heightDiff > DEVTOOLS_THRESHOLD;

    if (open && !devtoolsOpen) {
      devtoolsOpen = true;
      devtoolsOpenStart = Date.now();
      env.emit('devtools_open', {
        open: true,
        totalOpenMs: stats.totalDevtoolsMs,
        sessionMs: Date.now() - stats.sessionStartTs,
      });
    } else if (!open && devtoolsOpen) {
      devtoolsOpen = false;
      stats.totalDevtoolsMs += Date.now() - devtoolsOpenStart;
      env.emit('devtools_close', {
        open: false,
        totalOpenMs: stats.totalDevtoolsMs,
        sessionMs: Date.now() - stats.sessionStartTs,
      });
    }
  };
  const devtoolsTimer = window.setInterval(detectDevTools, 3000);
  window.addEventListener('resize', detectDevTools);
  cleanups.push(() => {
    window.clearInterval(devtoolsTimer);
    window.removeEventListener('resize', detectDevTools);
  });

  // ── Time to first submit + submission capture ─────────────────────────────
  const onDocumentClick = (e) => {
    const target = e.target;
    if (!target) return;
    const isSubmit =
      target.closest('button[data-e2e-locator="console-submit-button"]') ||
      (target.textContent?.trim() === 'Submit' && target.closest('button'));

    if (!isSubmit) return;

    const code = getEditorCode();
    const now = Date.now();
    if (stats.firstSubmitAt === null) {
      stats.firstSubmitAt = now;
      env.emit('time_to_first_submit', {
        seconds: Math.round((now - stats.sessionStartTs) / 1000),
      });
    }
    stats.submissionCount++;

    // Wait a moment for the verdict, then emit the submission event.
    const pollVerdict = (tries) => {
      const verdict = document.body.innerText.match(
        /(Accepted|Wrong Answer|Runtime Error|Time Limit Exceeded|Memory Limit Exceeded|Compile Error|Presentation Error)/,
      );
      if (verdict || tries <= 0) {
        env.emit('submission', {
          status: verdict ? verdict[1] : '',
          code,
          firstSubmission: stats.submissionCount === 1,
        });
      } else {
        window.setTimeout(() => pollVerdict(tries - 1), 800);
      }
    };
    pollVerdict(14);
  };
  document.addEventListener('click', onDocumentClick, true);
  cleanups.push(() => document.removeEventListener('click', onDocumentClick, true));

  return {
    stats,
    cleanup: () => cleanups.forEach((fn) => fn()),
  };
}
