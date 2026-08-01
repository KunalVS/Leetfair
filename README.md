# LeetFair

> **Prototype.** LeetFair is an early-stage, open-source anti-cheat tool for
> community-run coding contests. It's a proof of concept — not a finished
> product. Expect rough edges, false positives, and lots of iteration ahead.

Lately I noticed something that's been bothering me during LeetCode contests:
more and more people cheating, and it ruins the experience for everyone else.
It affects rankings, makes contests feel less competitive, and is discouraging
for people who are genuinely trying to improve. So I'm building **LeetFair** —
an open-source browser extension designed to assist in identifying potentially
suspicious behavior during coding contests.

The idea isn't to automatically label someone as a cheater. Instead, LeetFair
collects different **signals** that could indicate suspicious activity, such as:

- Long periods of inactivity (AFK) during a contest
- Large amounts of code being pasted or appearing all at once
- Timing patterns and other contest-related behavior

Based on these signals, it generates a **suspicion score** that helps
moderators prioritize which submissions or contestants deserve a closer look.

It is **opt-in only**: participants install a browser extension as a condition
of entry and consent to have behavioral signals recorded during a contest
session. LeetFair does **not** surveil arbitrary LeetCode users and does **not**
run on the public LeetCode contest ecosystem — only on contests that the
organizing community explicitly runs through LeetFair.

## Scope & Ethics

This project is intentionally opinionated about where the line is. Please read
this before deploying it anywhere.

1. **Opt-in only.** Every participant must explicitly install the extension and
   agree to it as a condition of entry. There is no silent background
   collection. The extension is inert until it detects a registered LeetFair
   contest session on a LeetCode problem page.

2. **Transparency, not black boxes.** Every participant can open the public
   transparency view for their own account and see *exactly* which signals were
   recorded, how their per-signal z-scores were computed relative to the contest
   cohort, and how weights were combined. Flagging someone should always come
   with an explanation they can read.

3. **A suspicion score is a triage signal, not a verdict.** The score ranks
   participants for **human review**. It is deliberately *not* wired to
   auto-bans. A high score means "a human should look at this person's session,"
   nothing more. A paste, a fast solve, or tab switching alone proves nothing —
   which is exactly why this aggregates many weak signals and normalizes them
   against the whole cohort.

4. **Data minimization.** The extension records *behavioral metrics*
   (timestamps, sizes, intervals, focus state) and the *code you submit* for
   similarity comparison. It does not read your clipboard content, does not
   keylog your passwords, and does not record anything outside the LeetCode
   contest page.

5. **Human rights in mind.** This software is designed to protect the *integrity
   of voluntary competitions*. It must not be repurposed for employer
   surveillance, government monitoring, or any context where consent is not
   genuine and revocable.

6. **MIT licensed.** You may fork and adapt it, but you are responsible for how
   you use it. Keep the transparency surface intact.

## Status

This is a **prototype**. It won't catch everything, and minimizing false
positives is the hardest part of the problem — the plan is to keep iterating,
make it more accurate over time, and let the community help shape it. Right now
it runs entirely from `npm install` (no Docker, no Redis): the backend uses an
in-memory MongoDB and an in-process job queue, and there's a seeded demo contest
so you can see scores immediately.

## What it measures

During a registered contest session the extension captures:

| Signal | What it is | Why it matters |
| --- | --- | --- |
| Paste events | Size (chars) + timestamp of every paste into the editor | Large/anomalous paste volumes relative to the cohort |
| Typing cadence | Inter-keystroke intervals while typing | Human rhythm is noisy; a bot replays a solution with robotic regularity |
| Focus loss | `visibilitychange` / `blur` / `focus` durations | Repeated tab-switching to look things up |
| DevTools open | Heuristic `outerWidth-innerWidth` detection | Curated console access |
| Time-to-first-submit | Page load → first submission | Instantaneous solutions are worth a look |
| AFK time | Periods of no typing/focus during the session | Sitting the contest out then "solving" at the end |

Every 15 seconds (and on contest end) the extension batches these events to the
backend. The backend z-score normalizes each signal against the contest cohort
and combines them into a weighted suspicion score in
`apps/backend/src/config/scoring.js`.

Submitted code is fingerprinted with a **winnowing** algorithm (k-grams +
windowed min-hash fingerprints) and compared asynchronously against other
participants' code and a corpus of known/published solutions. Similarity is a
*separate, peer-reviewed signal*, not an accusation by itself.

## Repository layout

```
/
├── apps/
│   ├── backend/         Node.js + Express + MongoDB (in-memory by default) (JavaScript)
│   │   ├── src/config/scoring.js   <-- ALL weights/score formula live here
│   │   ├── src/models    User, ContestSession, Event, SuspicionScore
│   │   ├── src/services  verification, winnowing similarity, aggregation, scoring
│   │   ├── src/workers   similarity-check worker (in-process queue)
│   │   └── src/jobs      scheduled post-contest aggregation
│   ├── dashboard/        React + Vite moderator + transparency views
│   └── extension/        Chrome Manifest V3 extension (JavaScript, esbuild)
│       ├── src/content   signal capture on leetcode.com contest pages
│       ├── src/background batcher + POST to backend every 15s
│       └── src/popup     username linking + session status
└── package.json          npm workspaces (apps/*) + shared scripts
```

## Prerequisites

- Node.js 20+
- Google Chrome (to load the unpacked extension)

No Docker, Redis or external MongoDB are required. The backend uses an
**in-memory MongoDB** and an **in-process job queue** by default so the whole
project runs from `npm install` alone. Point `MONGODB_URI` at a real MongoDB
instance if you want persistent data.

## Setup

Everything is one npm workspace. From the repo root:

```bash
npm install        # installs backend + dashboard + extension
```

Then run each app:

### 1. Backend

```bash
npm run dev:backend     # http://localhost:3000 (in-memory Mongo, no Docker)
```

Optional: `cp apps/backend/.env.example apps/backend/.env` and set
`MONGODB_URI` to connect to an external MongoDB. Leave it empty to keep using
the in-memory database.

### 2. Dashboard

```bash
npm run dev:dashboard    # http://localhost:5173 (proxies /api -> :3000)
```

### 3. Extension

```bash
npm run build:extension  # outputs apps/extension/dist/
```

Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**,
and select `apps/extension/dist`. Pin the LeetFair icon. In the popup, enter
your LeetCode username and the backend URL, then press **Link account**.

### 4. Try it instantly

With the default in-memory database, data lives only while the backend process
is running, so start the server *with* demo data:

```bash
$env:SEED_DEMO = "true"   # PowerShell; export SEED_DEMO=true on macOS/Linux
npm run dev:backend       # http://localhost:3000 (seeded with demo contest)
```

Then open http://localhost:5173 — the demo contest and its suspicion scores
appear in the dashboard. (Or run `npm run seed` once to generate demo data and
print the scores to the terminal.)

## Usage flow

1. **Create a contest** on the backend (or via seed script) with a name,
   `startAt`, and `endAt`. The contest has an id that participants' sessions
   attach to.
2. **Participants** open a LeetCode problem, ensure the extension is linked
   (popup shows *Active*), and solve. The extension silently batches signals in
   the background.
3. **Verify ownership** — a participant pastes a verification string into their
   LeetCode profile bio; the backend fetches the public profile and confirms it
   (`POST /users/verify`).
4. **After the contest closes**, the scheduled job aggregates events, computes
   cohort z-scores and the weighted suspicion score, and stores
   `SuspicionScore` documents. Code similarity checks run asynchronously
   (in-process queue by default) and feed a `codeSimilarity` signal.
5. **Moderators** open the dashboard, sort participants by score, and drill into
   any session: event timeline, paste log, similarity matches.
6. **Participants** open the public transparency view (`/u/:username`) and see
   exactly why a score was produced.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/events/batch` | Extension ingest for batched behavioral events |
| `POST` | `/users/verify` | Ownership check via LeetCode public-profile bio string |
| `GET`  | `/contests/:id/scores` | Ranked suspicion scores for a contest |
| `GET`  | `/contests/:id` | Contest metadata + session states |
| `GET`  | `/users/:username/events` | Full event timeline for one participant |
| `POST` | `/contests` | Create a contest (moderator/admin) |
| `GET`  | `/users/:username/transparency` | Public, self-serve transparency payload |

## Tuning the scoring formula

All weights, cutoffs and the weighted-combination math live in a single file:

```
apps/backend/src/config/scoring.js
```

The file is heavily commented: each signal's z-score, how outliers are trimmed,
and how weights combine. To tune behavior for your community, edit that one file
— nothing else.

## Contributing

This is an open-source project because it's a problem worth solving together.
If the idea interests you, or you have suggestions — particularly on reducing
false positives and making the signals more accurate — feedback and
contributions are welcome. Open an issue or a PR.

## License

[MIT](./LICENSE)

---

*LeetFair is a tool for volunteer communities to keep their competitions honest.
Use it with consent, transparency, and human judgment.*
