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

patch('src/lib/chatEstimator/persistence.ts', [
  ["export const QUOTE_EXPIRES_KEY = 'ttp_quote_expires_at';", "export const QUOTE_EXPIRES_KEY = 'ttp_quote_expires_at';\n/** Set by \"Work with again\" on a finished project; the estimator reads it once and starts a conversation for that painter. */\nexport const WORK_WITH_KEY = 'ttp_work_with_again';\n\nexport interface WorkWithAgain {\n  id: string;\n  companyName: string;\n  zip: string;\n}\n\nexport function readWorkWithAgain(): WorkWithAgain | null {\n  try {\n    const raw = sessionStorage.getItem(WORK_WITH_KEY);\n    if (!raw) return null;\n    const v = JSON.parse(raw) as Partial<WorkWithAgain>;\n    return v && typeof v.id === 'string' && v.id && typeof v.companyName === 'string' ? { id: v.id, companyName: v.companyName, zip: String(v.zip ?? '') } : null;\n  } catch {\n    return null;\n  }\n}\n\nexport function clearWorkWithAgain(): void {\n  try {\n    sessionStorage.removeItem(WORK_WITH_KEY);\n  } catch {\n    // ignore\n  }\n}"],
]);

// ---- the estimator: banner on top, fresh work-with-again conversation
patch('src/components/ChatEstimator/ChatPanel.tsx', [
  ["clearEstimatorSession, isExpiredFinishedChat } from '../../lib/chatEstimator/persistence';", "clearEstimatorSession, isExpiredFinishedChat, readWorkWithAgain, clearWorkWithAgain } from '../../lib/chatEstimator/persistence';"],
  ["function loadInitialState(): ChatState {\n  try {", "function loadInitialState(): ChatState {\n  // \"Work with again\" from a finished project starts a fresh conversation for that painter (the marker is cleared once mounted)\n  const workWith = readWorkWithAgain();\n  if (workWith) return makeWorkWithAgainState(workWith);\n  try {"],
  ["          if (current.history.length > 1 || current.finalEstimate) return current;", "          if (current.history.length > 1 || current.finalEstimate || current.ctx.preferredPainterId) return current;"],
  ["  useEffect(() => setupSpeechUnlock(), []);", "  useEffect(() => setupSpeechUnlock(), []);\n\n  // the \"Work with again\" marker has done its job once the conversation exists\n  useEffect(() => {\n    clearWorkWithAgain();\n  }, []);\n\n  function stopWorkingWithPainter() {\n    setState((s) => ({ ...s, ctx: { ...s.ctx, preferredPainterId: '', preferredPainterName: '' } }));\n  }"],
  ["          <p>Tell me about your project. Type naturally — I'll guide you from there.</p>\n        </div>\n",
   "          <p>Tell me about your project. Type naturally — I'll guide you from there.</p>\n        </div>\n\n        {state.ctx.preferredPainterName && (\n          <div className=\"chat-work-with-banner\" role=\"status\">\n            <span>\n              Working with <strong>{state.ctx.preferredPainterName}</strong>\n            </span>\n            {!state.finalEstimate && (\n              <button type=\"button\" onClick={stopWorkingWithPainter}>\n                Choose differently\n              </button>\n            )}\n          </div>\n        )}\n"],
]);

patch('src/styles/chat-estimator.css', [
  [".chat-estimator-header-row {", "/* \"Working with XXX Painting Company\": stays above the conversation (outside the scrolling messages) */\n.chat-work-with-banner {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  padding: 10px 24px;\n  background: rgba(116, 185, 255, 0.14);\n  border-bottom: 1px solid var(--accent-blue);\n  color: var(--text-primary);\n  font-size: 0.92rem;\n}\n\n.chat-work-with-banner button {\n  background: none;\n  border: none;\n  padding: 0;\n  color: var(--accent-blue);\n  font-size: 0.8rem;\n  text-decoration: underline;\n  cursor: pointer;\n  white-space: nowrap;\n}\n\n.chat-estimator-header-row {"],
]);

// ---- project history: the button
patch('src/pages/customer/CustomerProjects.tsx', [
  ["import { Link } from 'react-router-dom';", "import { Link, useNavigate } from 'react-router-dom';"],
  ["import { fmtRange } from '../../lib/dates';", "import { fmtRange } from '../../lib/dates';\nimport { WORK_WITH_KEY, clearEstimatorSession } from '../../lib/chatEstimator/persistence';\nimport { deleteAccountChatState } from '../../lib/chatEstimator/accountPersistence';"],
  ["  reviewSubmitted: boolean;\n  // email/phone/owner_name", "  reviewSubmitted: boolean;\n  /** Finished jobs only: the painter's id and the ZIP of the job, for \"Work with again\". */\n  painterId?: string | null;\n  zip?: string | null;\n  // email/phone/owner_name"],
  ["          {project.price != null && Math.floor(project.price / 100) > 0 && (\n            <span className=\"text-sm text-[var(--accent-blue)]\">",
   "          {project.painterId && project.painter?.company_name && (\n            <button\n              type=\"button\"\n              onClick={workWithAgain}\n              className=\"inline-block px-4 py-2 border border-[var(--accent-blue)] text-[var(--accent-blue)] text-sm font-semibold rounded-lg hover:bg-[var(--accent-blue)] hover:text-white transition-colors\"\n            >\n              Work with again\n            </button>\n          )}\n          {project.price != null && Math.floor(project.price / 100) > 0 && (\n            <span className=\"text-sm text-[var(--accent-blue)]\">"],
]);
console.log('ok');
