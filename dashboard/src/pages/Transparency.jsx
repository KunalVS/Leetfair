import { useState } from 'react';
import { get } from '../api/client';

/**
 * Public, self-serve transparency view. A participant can enter their own
 * username and see exactly what was recorded about them and how their score
 * was computed. No black boxes: if someone is flagged, they get to see why.
 *
 * Other participants' identities in similarity matches are redacted.
 */
export function Transparency() {
  const [username, setUsername] = useState('');
  const [contestId, setContestId] = useState('');
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function lookUp(e) {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true);
    setError('');
    setPayload(null);
    try {
      const q = contestId.trim() ? `?contestId=${contestId.trim()}` : '';
      setPayload(await get(`/users/${encodeURIComponent(username.trim())}/transparency${q}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <h1>Your transparency report</h1>
      <p className="hint">
        LeetFair records behavioral signals only while you participate in an opt-in contest
        session. Enter your username to see exactly what was recorded and how your suspicion
        score was derived. This is your right to understand — the score is a triage signal
        for human review, not a verdict.
      </p>

      <form className="lookup" onSubmit={lookUp}>
        <input
          placeholder="LeetCode username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          placeholder="Contest id (optional)"
          value={contestId}
          onChange={(e) => setContestId(e.target.value)}
        />
        <button type="submit" className="primary">
          {loading ? 'Looking up…' : 'View my report'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {payload && (
        <div className="report">
          <h2>{payload.username}</h2>

          {payload.scores.length === 0 ? (
            <p className="empty">
              No suspicion score exists for you yet. Scores are produced after the contest
              closes.
            </p>
          ) : (
            payload.scores.map((s) => (
              <div key={s.contestId} className="report-contest">
                <h3>
                  Contest <code>{s.contestId}</code>
                </h3>
                <div className="hero-row">
                  <div className="hero-score">{s.score.toFixed(1)}</div>
                  <p>
                    Your score is <strong>{s.score.toFixed(1)} / 100</strong>. It combines
                    per-signal z-scores (how unusual each measurement was relative to the
                    whole contest cohort). Higher means your session stood out — and a human
                    reviewer will look at it. It is not an automatic ban.
                  </p>
                </div>

                <h4>Per-signal breakdown</h4>
                <table className="plain">
                  <thead>
                    <tr>
                      <th>Signal</th>
                      <th>z-score</th>
                      <th>Meaning</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(s.zScores).map(([name, z]) => (
                      <tr key={name}>
                        <td>{name}</td>
                        <td>
                          {z >= 0 ? '+' : ''}
                          {z.toFixed(2)}
                        </td>
                        <td className="muted">{zMeaning(name, z)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}

          <h4>What was recorded</h4>
          <ul className="counts">
            {Object.entries(payload.eventCounts).map(([type, count]) => (
              <li key={type}>
                <code>{type}</code> × {count}
              </li>
            ))}
            {Object.keys(payload.eventCounts).length === 0 && (
              <li className="empty">Nothing recorded.</li>
            )}
          </ul>

          <h4>Code similarity checks</h4>
          {payload.submissions.length === 0 ? (
            <p className="empty">No submissions stored.</p>
          ) : (
            <table className="plain">
              <thead>
                <tr>
                  <th>Problem</th>
                  <th>Similarity</th>
                  <th>Matched</th>
                </tr>
              </thead>
              <tbody>
                {payload.submissions.map((sub) => (
                  <tr key={sub.submissionId}>
                    <td>{sub.problemSlug ?? ''}</td>
                    <td>{(sub.maxSimilarity * 100).toFixed(0)}%</td>
                    <td className="muted">
                      {sub.matched
                        ? sub.matched.source === 'corpus'
                          ? `known published solution (${(sub.matched.similarity * 100).toFixed(0)}%)`
                          : `another participant's code (${(sub.matched.similarity * 100).toFixed(0)}%)`
                        : 'no significant match'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}

function zMeaning(name, z) {
  if (Math.abs(z) < 1) return 'within the normal range for this contest.';
  if (z > 1) return 'above the cohort average — this stood out.';
  return 'below the cohort average.';
}
