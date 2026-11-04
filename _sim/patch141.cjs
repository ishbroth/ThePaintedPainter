const fs = require('fs');
function load(f) {
  const t = fs.readFileSync(f, 'utf8');
  return { crlf: t.includes('\r\n'), t: t.split('\r\n').join('\n') };
}
function save(f, o) {
  fs.writeFileSync(f, o.crlf ? o.t.split('\n').join('\r\n') : o.t);
}
function rep(o, a, b, label) {
  if (!o.t.includes(a)) throw new Error('NF ' + (label || a.slice(0, 70)));
  o.t = o.t.replace(a, () => b);
}
const o = load('src/pages/QuoteResults.tsx');
// the contact fields start from the account (and stay editable, e.g. for a different property)
rep(o, "  const [name, setName] = useState(ctx.contactName || '');\n  const [email, setEmail] = useState(ctx.contactEmail || '');\n  const [phone, setPhone] = useState(ctx.contactPhone || '');", "  const { user, profile } = useAuth();\n  const [name, setName] = useState(ctx.contactName || profile?.display_name || '');\n  const [email, setEmail] = useState(ctx.contactEmail || user?.email || '');\n  const [phone, setPhone] = useState(ctx.contactPhone || profile?.phone || '');");
rep(o, "  const [result, setResult] = useState<{ notifiedCount: number } | null>(null);\n  const { user } = useAuth();\n", `  const [result, setResult] = useState<{ notifiedCount: number } | null>(null);
  // No approved painter within range yet: a second popup explains what happens
  const [noPainters, setNoPainters] = useState(false);
  // The account loads a moment after the page does: fill the blank fields from it, never over what has been typed or changed
  const filled = useRef({ name: false, email: false, phone: false });
  useEffect(() => {
    if (!filled.current.name && !name && profile?.display_name) { filled.current.name = true; setName(profile.display_name); }
    if (!filled.current.email && !email && user?.email) { filled.current.email = true; setEmail(user.email); }
    if (!filled.current.phone && !phone && profile?.phone) { filled.current.phone = true; setPhone(profile.phone); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, user]);
`);
rep(o, "      setResult({ notifiedCount: data.notifiedCount });", "      if (data.noPainters) {\n        setNoPainters(true);\n        return;\n      }\n      setResult({ notifiedCount: data.notifiedCount });");
rep(o, "        {result ? (\n          <>\n            <h2 style={{ marginTop: 0 }}>You're all set!</h2>", `        {noPainters ? (
          <>
            <h2 style={{ marginTop: 0 }}>No painter in your area yet</h2>
            <p>
              There isn't a painter featured in your area yet, but <strong>The Painted Painter will find one for you within the next 48 hours.</strong>
            </p>
            <ul style={{ margin: '12px 0 0 18px', padding: 0, color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.6 }}>
              <li>You haven't been charged. A deposit is only collected after a painter accepts your job and you agree on a start date.</li>
              <li>If we can't find a painter within 48 hours, we'll let you know. Any deposit you've paid for this job is refunded automatically.</li>
              <li>The details of your job have been sent to us, and we're inviting local painting companies to take it. We'll email you at <strong>{email}</strong> the moment a painter accepts.</li>
            </ul>
            <button onClick={onClose} style={{ marginTop: 16, padding: '10px 20px', borderRadius: 10, border: 'none', background: 'var(--accent-blue)', color: 'var(--accent-blue-ink)', fontWeight: 700, cursor: 'pointer' }}>
              Got it
            </button>
          </>
        ) : result ? (
          <>
            <h2 style={{ marginTop: 0 }}>You're all set!</h2>`);
save('src/pages/QuoteResults.tsx', o);
console.log('ok');
