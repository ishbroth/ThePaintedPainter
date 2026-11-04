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

// ---- claim: store the customer's replies with the job, refuse abusive ones, pass them to the painters' emails
patch('supabase/functions/submit-quote-claim/index.ts', [
  ["  qa: ResponseQA[]\n  /** Optional — a request", "  qa: ResponseQA[]\n  /** Everything the customer typed in the chat, in order, so painters can read it. */\n  conversation?: string[]\n  /** Optional — a request"],
  ["    if (!selectionType || !guaranteedPrice || !customer?.name", "    const conversation = cleanConversation(body.conversation)\n    if (conversationRejected(conversation)) {\n      return new Response(\n        JSON.stringify({ error: \"Hmm… we can't send this one to painters. Please start over and tell us about your painting project.\", code: 'conversation_rejected' }),\n        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },\n      )\n    }\n\n    if (!selectionType || !guaranteedPrice || !customer?.name"],
  ["        project_summary: { qa, timeline, timelineLabel },", "        project_summary: { qa, timeline, timelineLabel, conversation },"],
  ["              qa,\n              photos: photos ?? [],\n            },", "              qa,\n              conversation,\n              conversationNote: conversationNote(conversation),\n              photos: photos ?? [],\n            },"],
]);
{
  const f = 'supabase/functions/submit-quote-claim/index.ts';
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  // add the import after the first import line
  const firstImport = t.indexOf("import ");
  const endOfLine = t.indexOf('\n', t.lastIndexOf("import ", t.indexOf('serve(')));
  t = t.slice(0, endOfLine + 1) + "import { cleanConversation, conversationRejected, conversationNote } from '../_shared/conversationLog.ts'\n" + t.slice(endOfLine + 1);
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}

// ---- re-sent offers (after a decline) carry the same words
patch('supabase/functions/_shared/offers.ts', [
  ["  project_summary: { qa?: unknown[]; timelineLabel?: string } | null", "  project_summary: { qa?: unknown[]; timelineLabel?: string; conversation?: string[] } | null"],
  ["        qa: job.project_summary?.qa ?? [],\n        photos: job.photos ?? [],", "        qa: job.project_summary?.qa ?? [],\n        conversation: job.project_summary?.conversation ?? [],\n        conversationNote: conversationNote(job.project_summary?.conversation ?? []),\n        photos: job.photos ?? [],"],
]);
{
  const f = 'supabase/functions/_shared/offers.ts';
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  const i = t.indexOf('\n', t.indexOf("import "));
  t = t.slice(0, i + 1) + "import { conversationNote } from './conversationLog.ts'\n" + t.slice(i + 1);
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}

// ---- the painter's accept page and the offer email show every reply
patch('supabase/functions/claim-job/index.ts', [
  ["      const summary = (job.project_summary ?? {}) as { timelineLabel?: string; qa?: { question: string; answer: string }[] }", "      const summary = (job.project_summary ?? {}) as { timelineLabel?: string; qa?: { question: string; answer: string }[]; conversation?: string[] }"],
  ["        qa: summary.qa ?? [],\n        photos: job.photos ?? [],", "        qa: summary.qa ?? [],\n        conversation: summary.conversation ?? [],\n        conversationNote: conversationNote(summary.conversation ?? []),\n        photos: job.photos ?? [],"],
]);
{
  const f = 'supabase/functions/claim-job/index.ts';
  let t = fs.readFileSync(f, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  const i = t.indexOf('\n', t.indexOf("import "));
  t = t.slice(0, i + 1) + "import { conversationNote } from '../_shared/conversationLog.ts'\n" + t.slice(i + 1);
  fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
}

patch('supabase/functions/send-email/index.ts', [
  ["      const photos = Array.isArray(data.photos) ? (data.photos as { url: string; description: string; label: string }[]) : []\n      const photosHtml = photos.length > 0",
   "      // every reply the customer typed, in order, so the painter can judge for themselves\n      const conversation = Array.isArray(data.conversation) ? (data.conversation as string[]) : []\n      const conversationHtml = conversation.length > 0\n        ? `\n          <hr style=\"border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;\" />\n          <p style=\"font-weight: 600; margin-bottom: 4px;\">What the customer typed (every reply, in order)</p>\n          ${data.conversationNote ? `<p style=\"margin: 4px 0 8px; font-size: 13px; color: #b45309;\">&#9888; ${escapeHtml(data.conversationNote)}</p>` : ''}\n          <ol style=\"margin: 8px 0; padding-left: 20px; font-size: 13px; color: #374151;\">\n            ${conversation.map((line) => `<li style=\"margin: 3px 0;\">${escapeHtml(line)}</li>`).join('')}\n          </ol>\n        `\n        : ''\n\n      const photos = Array.isArray(data.photos) ? (data.photos as { url: string; description: string; label: string }[]) : []\n      const photosHtml = photos.length > 0"],
  ["        ${qaHtml}\n        ${photosHtml}\n      `)\n    }\n\n    case 'job_confirmed_painter_details':", "        ${qaHtml}\n        ${conversationHtml}\n        ${photosHtml}\n      `)\n    }\n\n    case 'job_confirmed_painter_details':"],
]);

patch('src/pages/painter/AcceptJob.tsx', [
  ["  qa: { question: string; answer: string }[];\n  photos:", "  qa: { question: string; answer: string }[];\n  /** Everything the customer typed in the chat, in order. */\n  conversation?: string[];\n  conversationNote?: string | null;\n  photos:"],
  ["          {preview.photos.length > 0 && (\n            <div style={{ ...card, display: 'flex', gap: 8, flexWrap: 'wrap' }}>", "          {preview.conversation && preview.conversation.length > 0 && (\n            <div style={card}>\n              <p style={{ color: 'var(--text-primary)', fontWeight: 600, margin: '0 0 4px' }}>What the customer typed (every reply, in order)</p>\n              {preview.conversationNote && <p style={{ color: '#b45309', fontSize: '0.85rem', margin: '4px 0 8px' }}>⚠ {preview.conversationNote}</p>}\n              <ol style={{ margin: '8px 0 0', paddingLeft: 20, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>\n                {preview.conversation.map((line, i) => (\n                  <li key={i} style={{ margin: '3px 0' }}>{line}</li>\n                ))}\n              </ol>\n            </div>\n          )}\n\n          {preview.photos.length > 0 && (\n            <div style={{ ...card, display: 'flex', gap: 8, flexWrap: 'wrap' }}>"],
]);

// ---- the browser sends the words with the claim
patch('src/components/ChatEstimator/ChatPanel.tsx', [
  ["          loyaltyDiscountPercent: state.finalEstimate!.loyaltyDiscountPercent ?? 0,\n        };", "          loyaltyDiscountPercent: state.finalEstimate!.loyaltyDiscountPercent ?? 0,\n          // every reply the customer typed, in order; it goes to painters with the job\n          userMessages: state.history.filter((m) => m.role === 'user').map((m) => m.text),\n        };"],
]);
patch('src/pages/QuoteResults.tsx', [
  ["  transcript: string;\n  loyaltyDiscountPercent?: number;", "  transcript: string;\n  /** Everything the customer typed, in order (sent to painters with the job). */\n  userMessages?: string[];\n  loyaltyDiscountPercent?: number;"],
]);
console.log('ok');
