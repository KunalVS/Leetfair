import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get } from '../api/client';

/**
 * Moderator drill-down: one participant's session. Shows the per-signal
 * z-scores that produced the suspicion score, the raw event timeline, paste
 * events, and code-similarity matches. This is what a human reviews.
 */
export function UserDrilldown() {
  const { contestId, username } = useParams();
  const [score, setScore] = useState(null);
  const [timeline, setTimeline] = useState(null);
  const [transparency, setTransparency] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const u = username;
    get(`/contests/${contestId}/scores`)
      .then((r) => setScore(r.scores.find((s) => s.username === u) ?? null))
      .catch((e) => setError(e.message));
    get(`/users/${u}/events?contestId=${contestId}`)
      .then(setTimeline)
      .catch((e) => setError(e.message));
    get(`/users/${u}/transparency?contestId=${contestId}`)
      .then(setTransparency)
      .catch((e) => setError(e.message));
  }, [contestId, username]);

  if (error) return <p className="error">{error}</p>;

  const pasteEvents = timeline?.events.filter((e) => e.type === 'paste') ?? [];

  return (
    <section>
      <p>
        <Link to="/">← back to triage</Link>
      </p>
      <h1>{username}</h1>
      {score ? (
        <div className="score-hero">
          <div>
            <div className="hero-score">{score.score.toFixed(1)}</div>
            <div className="hero-label">suspicion score</div>
          </div>
          <div className="hero-raw">
            {Object.entries(score.zScores).map(([name, z]) => (
              <ZBar key={name} name={name} z={z} />
            ))}
          </div>
        </div>
      ) : (
        <p className="empty">No suspicion score yet for this contest.</p>
      )}

      <h2>Signal z-scores</h2>
      <p className="hint">
        Each value is this participant's z-score relative to the contest cohort. Positive =
        more than cohort average, negative = less. Clipped to ±3.5.
      </p>
      {score && (
        <div className="zgrid">
          {Object.entries(score.zScores).map(([name, z]) => (
            <div key={name} className="z-item">
              <span>{name}</span>
              <strong style={{ color: z > 1 ? '#f87171' : z < -1 ? '#60a5fa' : 'inherit' }}>
                {z >= 0 ? '+' : ''}
                {z.toFixed(2)}
              </strong>
            </div>
          ))}
        </div>
      )}

      <h2>Paste events</h2>
      {pasteEvents.length === 0 ? (
        <p className="empty">No paste events recorded.</p>
      ) : (
        <table className="plain">
          <thead>
            <tr>
              <th>Time</th>
              <th>Size (chars)</th>
              <th>Problem</th>
            </tr>
          </thead>
          <tbody>
            {pasteEvents.map((e, i) => (
              <tr key={i}>
                <td>{new Date(e.ts).toLocaleTimeString()}</td>
                <td>{String(e.data.size ?? '')}</td>
                <td>{e.problemSlug ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>Code similarity</h2>
      {transparency && transparency.submissions.length === 0 ? (
        <p className="empty">No submissions recorded.</p>
      ) : (
        <table className="plain">
          <thead>
            <tr>
              <th>Problem</th>
              <th>Language</th>
              <th>Status</th>
              <th>Similarity</th>
              <th>Matched against</th>
              <th>Code</th>
            </tr>
          </thead>
          <tbody>
            {(transparency?.submissions ?? []).map((s) => (
              <SubmissionRow key={s.submissionId} sub={s} />
            ))}
          </tbody>
        </table>
      )}

      <h2>Event timeline</h2>
      {timeline && timeline.events.length === 0 ? (
        <p className="empty">No events recorded.</p>
      ) : (
        <div className="timeline">
          {timeline?.events.map((e, i) => (
            <TimelineRow key={i} e={e} />
          ))}
        </div>
      )}
    </section>
  );
}

function ZBar({ name, z }) {
  const width = Math.min(100, Math.abs(z) * 25);
  return (
    <div className="zbar">
      <span className="zbar-name">{name}</span>
      <div className="zbar-track">
        <div className={`zbar-fill ${z < 0 ? 'neg' : 'pos'}`} style={{ width: `${width}%` }} />
      </div>
      <span className="zbar-val">{z.toFixed(2)}</span>
    </div>
  );
}

function SubmissionRow({ sub }) {
  const [open, setOpen] = useState(false);
  return (
    <tr>
      <td>{sub.problemSlug ?? ''}</td>
      <td>{sub.language ?? ''}</td>
      <td>{sub.status ?? ''}</td>
      <td>
        <strong style={{ color: sub.maxSimilarity >= 0.6 ? '#f87171' : 'inherit' }}>
          {(sub.maxSimilarity * 100).toFixed(0)}%
        </strong>
      </td>
      <td>
        {sub.matched
          ? `${sub.matched.source === 'corpus' ? 'known solution' : 'another participant'} (${(
              sub.matched.similarity * 100
            ).toFixed(0)}%)`
          : '—'}
      </td>
      <td>
        <button className="linklike" onClick={() => setOpen((o) => !o)}>
          {open ? 'hide' : 'view'}
        </button>
        {open && <pre className="code">{sub.code}</pre>}
      </td>
    </tr>
  );
}

function TimelineRow({ e }) {
  return (
    <div className="tl-row">
      <span className="tl-time">{new Date(e.ts).toLocaleTimeString()}</span>
      <span className={`tl-type ${e.type}`}>{e.type}</span>
      <span className="tl-data">{formatData(e)}</span>
      {e.problemSlug && <span className="tl-problem">{e.problemSlug}</span>}
    </div>
  );
}

function formatData(e) {
  const d = e.data;
  if (e.type === 'paste') return `+${d.size ?? 0} chars`;
  if (e.type === 'typing') return `mean ${d.intervalMeanMs ?? 0}ms · sd ${d.intervalStdDevMs ?? 0}ms`;
  if (e.type === 'focus_change') return `${d.state ?? ''} (${d.durationMs ?? 0}ms)`;
  if (e.type === 'submission') return `status=${d.status ?? ''}`;
  if (e.type === 'time_to_first_submit') return `${d.seconds ?? 0}s to first submit`;
  return '';
}
