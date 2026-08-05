import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { Moderator } from './pages/Moderator';
import { UserDrilldown } from './pages/UserDrilldown';
import { Transparency } from './pages/Transparency';

export function App() {
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <Link to="/">
            <span className="logo">LF</span> LeetFair
          </Link>
        </div>
        <nav>
          <NavLink to="/" end>
            Moderator
          </NavLink>
          <NavLink to="/transparency" end>
            My transparency
          </NavLink>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Moderator />} />
          <Route path="/contest/:contestId/user/:username" element={<UserDrilldown />} />
          <Route path="/transparency" element={<Transparency />} />
        </Routes>
      </main>

      <footer className="foot">
        Suspicion scores are <em>triage signals for human review</em> — not verdicts, never auto-bans.
      </footer>
    </div>
  );
}
