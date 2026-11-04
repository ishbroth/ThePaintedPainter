const fs = require('fs');
const rep = (s, a, b, label) => { if (!s.includes(a)) throw new Error('missing: ' + label); return s.replace(a, () => b); };

// ---- Header
let p = 'src/components/Header.tsx';
let s = fs.readFileSync(p, 'utf8');
s = rep(s, "  const { user, profile, signOut } = useAuth();", "  const { user, profile, loading, signOut } = useAuth();", 'auth');
s = rep(s, "  const displayName =", `  // The two links that depend on who is signed in. A painter has no use for the estimator, so it becomes their dashboard, and "For Painters" becomes
  // their projects; a customer keeps the estimator and gets their own projects in place of "For Painters". While we do not yet know whose account it is,
  // neither is shown (so the wrong ones never flash).
  const isPainter = profile?.role === 'painter';
  const isCustomer = profile?.role === 'customer';
  const unknown = loading || (!!user && !profile);

  const displayName =`, 'roles');
s = rep(s, `          <Link to="/#estimator" onClick={closeMenu}>
            Get Your Price
          </Link>
          <Link to="/painter-signup" onClick={closeMenu}>
            For Painters
          </Link>`, `          {!unknown && (isPainter ? (
            <Link to="/painter/dashboard" onClick={closeMenu}>
              Dashboard
            </Link>
          ) : (
            <Link to="/#estimator" onClick={closeMenu}>
              Get Your Price
            </Link>
          ))}
          {!unknown && (isPainter ? (
            <Link to="/painter/dashboard/projects" onClick={closeMenu}>
              My Projects
            </Link>
          ) : isCustomer ? (
            <Link to="/customer/dashboard/projects" onClick={closeMenu}>
              My Projects
            </Link>
          ) : (
            <Link to="/painter-signup" onClick={closeMenu}>
              For Painters
            </Link>
          ))}`, 'links');
fs.writeFileSync(p, s);

// ---- Footer: the same two links
p = 'src/components/Footer.tsx';
s = fs.readFileSync(p, 'utf8');
s = rep(s, "import { Link } from 'react-router-dom';", "import { Link } from 'react-router-dom';\nimport { useAuth } from '../lib/auth';", 'footer imp');
s = rep(s, "const Footer = () => {\n  return (", "const Footer = () => {\n  const { user, profile, loading } = useAuth();\n  const isPainter = profile?.role === 'painter';\n  const isCustomer = profile?.role === 'customer';\n  const unknown = loading || (!!user && !profile);\n  return (", 'footer top');
s = rep(s, `        <Link to="/">Get Your Price</Link>
        <Link to="/painter-signup">For Painters</Link>`, `        {!unknown && (isPainter ? <Link to="/painter/dashboard">Dashboard</Link> : <Link to="/">Get Your Price</Link>)}
        {!unknown && (isPainter ? <Link to="/painter/dashboard/projects">My Projects</Link> : isCustomer ? <Link to="/customer/dashboard/projects">My Projects</Link> : <Link to="/painter-signup">For Painters</Link>)}`, 'footer links');
fs.writeFileSync(p, s);

// ---- Home: no estimator for a painter
p = 'src/pages/Home.tsx';
s = fs.readFileSync(p, 'utf8');
s = rep(s, "import ChatPanel from '../components/ChatEstimator/ChatPanel';", "import { Link } from 'react-router-dom';\nimport ChatPanel from '../components/ChatEstimator/ChatPanel';\nimport { useAuth } from '../lib/auth';", 'home imp');
s = rep(s, "const Home = () => {\n", "const Home = () => {\n  const { profile } = useAuth();\n  const isPainter = profile?.role === 'painter';\n", 'home top');
s = rep(s, "      <ChatPanel />\n", `      {isPainter ? (
        <section className="about-text" id="estimator" style={{ textAlign: 'center' }}>
          <h2>You're signed in as a painter</h2>
          <p>The price estimator is for customers. Your jobs, schedule and profile are on your dashboard.</p>
          <p><Link to="/painter/dashboard" className="nav-cta">Go to your dashboard</Link></p>
        </section>
      ) : (
        <ChatPanel />
      )}
`, 'home estimator');
fs.writeFileSync(p, s);

// ---- the customer-side pages: a painter goes to the dashboard
p = 'src/App.tsx';
s = fs.readFileSync(p, 'utf8');
s = rep(s, "import QuoteResults from './pages/QuoteResults';", "import QuoteResults from './pages/QuoteResults';\nimport NotForPainters from './components/NotForPainters.tsx';", 'app imp');
s = rep(s, '<Route path="/quote-results" element={<QuoteResults />} />', '<Route path="/quote-results" element={<NotForPainters><QuoteResults /></NotForPainters>} />', 'quote');
s = rep(s, '<Route path="/choose-painter" element={<ChoosePainter />} />', '<Route path="/choose-painter" element={<NotForPainters><ChoosePainter /></NotForPainters>} />', 'choose');
s = rep(s, '<Route path="/resume-search" element={<ResumeSearch />} />', '<Route path="/resume-search" element={<NotForPainters><ResumeSearch /></NotForPainters>} />', 'resume');
fs.writeFileSync(p, s);
console.log('ok');
