const fs = require('fs');
function patch(file, edits) {
  let t = fs.readFileSync(file, 'utf8');
  const crlf = t.includes('\r\n');
  t = t.split('\r\n').join('\n');
  for (const [from, to] of edits) {
    if (!t.includes(from)) throw new Error('[' + file + '] not found: ' + from.slice(0, 90));
    t = t.replace(from, () => to);
  }
  fs.writeFileSync(file, crlf ? t.split('\n').join('\r\n') : t);
}
patch('src/pages/QuoteResults.tsx', [
  ["import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';", "import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';"],
  ["import PainterResultCard from '../components/results/PainterResultCard';", "import PainterResultCard from '../components/results/PainterResultCard';\nimport PriceBreakdown from '../components/results/PriceBreakdown';\nimport { baseFromResult, buildPriceEditor } from '../lib/priceEditing';"],
  ["  transcript: string;\n  expiresAt?: number;", "  transcript: string;\n  loyaltyDiscountPercent?: number;\n  expiresAt?: number;"],
  // state + editor
  ["  const state = loadState(location.state as LocationState | null);\n  const [breakdownOpen, setBreakdownOpen] = useState(false);",
    `  const state = loadState(location.state as LocationState | null);
  const [breakdownOpen, setBreakdownOpen] = useState(false);

  // Price editing: rooms and main items the customer takes off (and adds back) after seeing the price.
  const [edits, setEdits] = useState<{ rooms: string[]; items: string[] }>({
    rooms: state?.ctx.excludedRooms ?? [],
    items: state?.ctx.excludedItems ?? [],
  });
  const editBase = useMemo(
    () => (state && state.transcript ? baseFromResult({ ctx: state.ctx, transcript: state.transcript, loyaltyDiscountPercent: state.loyaltyDiscountPercent }) : null),
    // the saved price never changes underneath the editor; edits are tracked separately
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state?.transcript],
  );
  const view = useMemo(() => (editBase ? buildPriceEditor(editBase, edits.rooms, edits.items) : null), [editBase, edits]);
  const liveEstimate: EstimateBreakdown | undefined = view?.current.estimate ?? state?.estimate;
  const liveCtx: EstimatorContext | undefined = view?.current.ctx ?? state?.ctx;
  const edited = edits.rooms.length > 0 || edits.items.length > 0;`],
  // loadResults uses live price
  ["  const loadResults = useCallback(() => {\n    if (!state) return () => {};\n    let cancelled = false;\n    fetchPainterResults(state.ctx, state.estimate.total, state.resumeToken).then((r) => {",
    "  const liveTotal = liveEstimate?.total ?? 0;\n  const resumeTokenForFetch = state?.resumeToken;\n  const loadResults = useCallback(() => {\n    if (!liveCtx) return () => {};\n    let cancelled = false;\n    fetchPainterResults(liveCtx, liveTotal, resumeTokenForFetch).then((r) => {"],
  ["    return () => {\n      cancelled = true;\n    };\n  }, [state]);\n\n  useEffect(() => loadResults(), [loadResults]);",
    `    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTotal, edits, resumeTokenForFetch]);

  // A price edit refreshes the painters' prices after a short pause (so several quick taps make one request).
  const firstLoad = useRef(true);
  useEffect(() => {
    if (firstLoad.current) {
      firstLoad.current = false;
      return loadResults();
    }
    setResults(null);
    setResultsFailed(false);
    let cancel: (() => void) | undefined;
    const t = setTimeout(() => { cancel = loadResults(); }, 350);
    return () => { clearTimeout(t); cancel?.(); };
  }, [loadResults]);

  // Keep an edited price if the page is reloaded.
  useEffect(() => {
    if (!state || !edited || !liveEstimate || !liveCtx) return;
    try {
      sessionStorage.setItem(QUOTE_RESULT_KEY, JSON.stringify({ ...state, estimate: liveEstimate, ctx: liveCtx, expiresAt: expiresAtRef.current }));
    } catch {
      // storage unavailable: the edit just won't survive a reload
    }
  }, [state, edited, liveEstimate, liveCtx]);`],
  ["  const { estimate, ctx, assumptions } = state;", "  const estimate = liveEstimate ?? state.estimate;\n  const ctx = liveCtx ?? state.ctx;\n  const { assumptions } = state;"],
  // grouped no longer needed
  ["  // Group line items by category\n  const grouped: Record<string, typeof estimate.lineItems> = {};\n  for (const li of estimate.lineItems) {\n    grouped[li.category] = grouped[li.category] ?? [];\n    grouped[li.category].push(li);\n  }\n", ""],
  ["        <h1>Your Estimate</h1>", "        <h1>Your Price</h1>"],
  ["          resumeState={{ ctx, estimate, assumptions }}", "          resumeState={{ ctx, estimate, assumptions, transcript: state.transcript, loyaltyDiscountPercent: state.loyaltyDiscountPercent }}"],
]);
console.log('ok');
