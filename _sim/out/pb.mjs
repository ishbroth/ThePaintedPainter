function painterBreakdown(raw, payout) {
  if (!Array.isArray(raw) || !isFinite(payout) || payout <= 0) return [];
  const kept = [];
  const removed = [];
  for (const item of raw.slice(0, 60)) {
    const description = typeof item?.description === "string" ? item.description.replace(/\s+/g, " ").trim().slice(0, 90) : "";
    const amount = typeof item?.amount === "number" && isFinite(item.amount) ? item.amount : 0;
    if (!description || amount <= 0) continue;
    if (item?.removed === true) removed.push({ description, amount, removed: true });
    else kept.push({ description, amount });
  }
  const total = kept.reduce((sum, l) => sum + l.amount, 0);
  if (kept.length === 0 || total <= 0) return [];
  const scale = payout / total;
  const scaled = kept.map((l) => ({ description: l.description, amount: Math.round(l.amount * scale * 100) / 100 }));
  const diff = Math.round((payout - scaled.reduce((sum, l) => sum + l.amount, 0)) * 100) / 100;
  if (diff !== 0) {
    const biggest = scaled.reduce((best, l) => l.amount > best.amount ? l : best, scaled[0]);
    biggest.amount = Math.round((biggest.amount + diff) * 100) / 100;
  }
  const gone = removed.slice(0, 20).map((l) => ({ description: l.description, amount: Math.round(l.amount * scale * 100) / 100, removed: true }));
  return [...scaled, ...gone];
}
export {
  painterBreakdown
};
