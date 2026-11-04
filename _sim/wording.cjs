const fs = require('fs');
const edits = {
  'src/components/ChatEstimator/ChatPanel.tsx': [['Get Your Free Painting Estimate', 'Get Your Free Painting Price'], ['Start a New Estimate', 'Get a New Price']],
  'src/components/Footer.tsx': [['Get Estimate', 'Get Your Price']],
  'src/components/Header.tsx': [['Get Estimate', 'Get Your Price']],
  'src/pages/auth/CustomerSignUp.tsx': [['save your estimates', 'save your prices']],
  'src/pages/ConfirmJob.tsx': [['Estimated time on site', 'Expected time on site']],
  'src/pages/QuoteResults.tsx': [['Estimated time on site', 'Expected time on site']],
  'src/pages/customer/CustomerDashboard.tsx': [['Get New Estimate', 'Get a New Price']],
  'src/pages/Home.tsx': [['instant AI-powered estimate', 'instant AI-powered price']],
  'src/pages/PainterPublicProfile.tsx': [['Get a free estimate', 'Get a free price'], ['Get an Estimate', 'Get a Price']],
  'src/pages/Support.tsx': [['instant AI-powered estimate for your project', 'instant AI-powered price for your project'], ['when getting an estimate', 'when getting your price'], ['from estimate to completion', 'from price to completion'], ["title: 'Get an Estimate', desc: 'Answer a few questions and get an instant AI-powered estimate.'", "title: 'Get Your Price', desc: 'Answer a few questions and get an instant AI-powered price.'"], ['Instant AI-powered estimates', 'Instant AI-powered prices'], ['Get Your Estimate', 'Get Your Price']],
  'src/lib/chatEstimator/topics.ts': [['Totally free to get the estimate', 'Totally free to get your price'], ['we\'ll have your estimate in under two minutes', 'we\'ll have your price in under two minutes']],
  'supabase/functions/send-email/index.ts': [['Your painting estimate for', 'Your painting price for'], ['View Your Estimate', 'View Your Price'], ['This estimate is valid for 30 days', 'This price is valid for 30 days']],
};
for (const [file, list] of Object.entries(edits)) {
  let t = fs.readFileSync(file, 'utf8');
  for (const [a, b] of list) {
    if (!t.includes(a)) { console.log('MISSING', file, a); continue; }
    t = t.split(a).join(b);
  }
  fs.writeFileSync(file, t);
}
