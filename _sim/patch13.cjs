const fs = require('fs');
const f = 'src/pages/QuoteResults.tsx';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
t = t.replace("  const liveEstimate: EstimateBreakdown | undefined = view?.current.estimate ?? state?.estimate;",
`  // Older saved prices don't carry the wording they were built from, so they show as before and can't be edited.
  const shownView = useMemo(
    () =>
      view ??
      (state
        ? {
            current: { estimate: state.estimate, ctx: state.ctx, assumptions: state.assumptions, matchedSituations: state.matchedSituations ?? [], summary: '' },
            originalTotal: state.estimate.total,
            rows: [],
            rooms: [],
            canRemoveMore: false,
          }
        : null),
    [view, state],
  );
  const liveEstimate: EstimateBreakdown | undefined = view?.current.estimate ?? state?.estimate;`);
t = t.replace('{breakdownOpen && view && (\n        <PriceBreakdown\n          view={view}', '{breakdownOpen && shownView && (\n        <PriceBreakdown\n          view={shownView}');
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
