const fs = require('fs');
function patch(file, edits) {
  let t = fs.readFileSync(file, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [from, to] of edits) {
    if (!t.includes(from)) throw new Error('[' + file + '] not found: ' + from.slice(0, 80));
    t = t.replace(from, () => to);
  }
  fs.writeFileSync(file, crlf ? t.split('\n').join('\r\n') : t);
}
patch('src/components/ChatEstimator/ChatPanel.tsx', [
  ["  makeInitialState,", "  makeInitialState,\n  makeWorkWithAgainState,"],
]);
patch('src/pages/customer/CustomerProjects.tsx', [
  ["function ProjectCard({ project }: { project: Project }) {\n  return (",
   `function ProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  /** Start a new price for the painter who did this job: their ZIP is known and they come first in the results. */
  function workWithAgain() {
    if (!project.painterId || !project.painter) return;
    // a new estimate replaces anything half-finished, here and on the account
    clearEstimatorSession();
    if (user) void deleteAccountChatState(user.id);
    try {
      sessionStorage.setItem(WORK_WITH_KEY, JSON.stringify({ id: project.painterId, companyName: project.painter.company_name, zip: project.zip ?? '' }));
    } catch {
      // storage unavailable: the estimator just starts as usual
    }
    navigate('/#estimator');
  }

  return (`],
]);
patch('src/components/results/PainterResultCard.tsx', [
  ["            <h3 style={{ fontFamily: \"'Cabin', sans-serif\", fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px' }}>\n              {result.companyName}\n            </h3>",
   "            {result.workedWithBefore && (\n              <span style={{ display: 'inline-block', marginBottom: 6, padding: '2px 10px', borderRadius: 999, fontSize: '0.74rem', fontWeight: 700, color: 'var(--accent-blue)', background: 'rgba(116, 185, 255, 0.14)', border: '1px solid var(--accent-blue)' }}>\n                ★ You've worked with them before\n              </span>\n            )}\n            <h3 style={{ fontFamily: \"'Cabin', sans-serif\", fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 2px' }}>\n              {result.companyName}\n            </h3>"],
  ["      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 14, overflow: 'hidden' }}", "      style={{ background: 'var(--bg-surface)', border: result.workedWithBefore ? '2px solid var(--accent-blue)' : '1px solid var(--border)', borderRadius: 12, marginBottom: 14, overflow: 'hidden' }}"],
]);
patch('src/pages/QuoteResults.tsx', [
  ["        <div className=\"quote-results-price\">{currency(estimate.total)}</div>\n        <div className=\"quote-results-range\">\n          Likely range: {currency(estimate.lowRange)} – {currency(estimate.highRange)}\n        </div>",
   "        {firstPainter?.workedWithBefore && (\n          <div style={{ color: 'var(--accent-blue)', fontWeight: 700, fontSize: '0.95rem', marginBottom: 4 }}>Your price with {firstPainter.companyName}</div>\n        )}\n        <div className=\"quote-results-price\">{currency(headlinePrice)}</div>\n        <div className=\"quote-results-range\">\n          Likely range: {currency(Math.round(estimate.lowRange * priceScale))} – {currency(Math.round(estimate.highRange * priceScale))}\n        </div>"],
  ["  const { assumptions } = state;", "  const { assumptions } = state;\n\n  // \"Work with again\": that painter is listed first, and the price shown up top is theirs\n  const firstPainter = painterMatches && painterMatches.length > 0 ? painterMatches[0] : null;\n  const headlinePrice = firstPainter?.workedWithBefore ? firstPainter.price : estimate.total;\n  const priceScale = estimate.total > 0 ? headlinePrice / estimate.total : 1;\n  const preferredOutcome = results?.preferred;"],
  ["      {/* Real painter list */}\n      <div className=\"painter-list-header\">\n        <h2>Painters who can do this job</h2>",
   "      {/* Real painter list */}\n      {preferredOutcome?.status === 'unavailable' && (\n        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--accent)', borderRadius: 10, padding: '12px 16px', margin: '0 0 16px', fontSize: '0.92rem', color: 'var(--text-secondary)' }}>\n          <strong style={{ color: 'var(--text-primary)' }}>{preferredOutcome.companyName}</strong> {preferredOutcome.reason ?? \"can't take this job\"}, so here are other painters near you.\n        </div>\n      )}\n      <div className=\"painter-list-header\">\n        <h2>Painters who can do this job</h2>"],
  ["              {painterMatches.length} painter{painterMatches.length === 1 ? '' : 's'} in your area, nearest first. Pick\n              one to claim their guaranteed price.",
   "              {painterMatches.length} painter{painterMatches.length === 1 ? '' : 's'} in your area{firstPainter?.workedWithBefore ? `, with ${firstPainter.companyName} first and the rest nearest first` : ', nearest first'}. Pick\n              one to claim their guaranteed price."],
]);
console.log('ok');
