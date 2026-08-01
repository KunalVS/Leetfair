import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, post } from '../api/client';

/**
 * Moderator view: pick a contest, see participants sorted by suspicion score.
 * A score here is a *ranking for human review*, not a verdict. Also lets a
 * moderator create a contest directly from the dashboard (POST /contests).
 */
export function Moderator() {
  const [contests, setContests] = useState([]);
  const [selected, setSelected] = useState('');
  const [scores, setScores] = useState(null);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  async function loadContests(preferId) {
    try {
      const c = await get('/contests');
      setContests(c);
      setSelected(preferId ?? (c.length > 0 ? c[0]._id : ''));
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    void loadContests();
  }, []);

  useEffect(() => {
    if (!selected) return;
    setScores(null);
    get(`/contests/${selected}/scores`)
      .then((r) => setScores(r.scores))
      .catch((e) => setError(e.message));
  }, [selected]);

  const selectedContest = contests.find((c) => c._id === selected);

  return (
    <section>
      <div className="page-head">
        <h1>Contest triage</h1>
        <button className="linklike" onClick={() => setShowCreate((s) => !s)}>
          {showCreate ? 'hide' : '+ create contest'}
        </button>
      </div>

      {showCreate && <CreateContestForm onCreated={(id) => void loadContests(id)} />}

      {error && <p className="error">Backend unreachable: {error}. Is the API running?</p>}

      {contests.length > 0 && (
        <label className="picker">
          Contest
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            {contests.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name} — {new Date(c.startAt).toLocaleDateString()}
              </option>
            ))}
          </select>
        </label>
      )}

      {selectedContest && (
        <p className="meta">
          {selectedContest.participantCount} participant(s) · ends{' '}
          {new Date(selectedContest.endAt).toLocaleString()}
        </p>
      )}

      {scores === null && selected ? (
        <p>Loading scores…</p>
      ) : scores && scores.length === 0 ? (
        <p className="empty">
          No scores yet. Scores are produced shortly after the contest ends
          (or run POST /contests/:id/aggregate).
        </p>
      ) : (
        scores && (
          <table className="score-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Participant</th>
                <th>Suspicion score</th>
                <th>Review status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {scores.map((s, i) => (
                <tr key={s.username} className={s.score >= 70 ? 'hot' : ''}>
                  <td>{i + 1}</td>
                  <td>{s.username}</td>
                  <td>
                    <div className="score-cell">
                      <span>{s.score.toFixed(1)}</span>
                      <div className="bar">
                        <div className="fill" style={{ width: `${Math.min(100, s.score)}%` }} />
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${s.reviewStatus ?? 'unreviewed'}`}>
                      {s.reviewStatus ?? 'unreviewed'}
                    </span>
                  </td>
                  <td>
                    <Link to={`/contest/${s.contestId}/user/${s.username}`}>drill down →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </section>
  );
}

function CreateContestForm({ onCreated }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [problems, setProblems] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      const body = {
        name,
        slug: slug.trim() || undefined,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        createdBy: createdBy.trim(),
        problemSlugs: problems
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };
      const created = await post('/contests', body);
      setMsg(`Created "${name}". Participants can now join via the extension.`);
      setName('');
      setSlug('');
      setProblems('');
      onCreated(created._id);
    } catch (err) {
      setMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="create-form" onSubmit={submit}>
      <h2>Create contest</h2>
      <div className="form-grid">
        <label>
          Name
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekly #1" />
        </label>
        <label>
          Slug (matches LeetCode contest URL)
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="weekly-1" />
        </label>
        <label>
          Starts
          <input required type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
        </label>
        <label>
          Ends
          <input required type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />
        </label>
        <label>
          Created by (moderator username)
          <input required value={createdBy} onChange={(e) => setCreatedBy(e.target.value)} placeholder="moderator" />
        </label>
        <label>
          Problems (comma-separated slugs, optional)
          <input value={problems} onChange={(e) => setProblems(e.target.value)} placeholder="two-sum, valid-parentheses" />
        </label>
      </div>
      <button type="submit" className="primary" disabled={busy}>
        {busy ? 'Creating…' : 'Create'}
      </button>
      {msg && <p className={`form-msg ${msg.includes('Created') ? 'ok' : 'err'}`}>{msg}</p>}
    </form>
  );
}
