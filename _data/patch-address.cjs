const fs = require('fs');
const edit = (p, fn) => { const raw = fs.readFileSync(p, 'utf8'); const crlf = raw.includes('\r\n'); const s = fn(raw.replace(/\r\n/g, '\n')); fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s); };
const rep = (s, a, b, l) => { if (!s.includes(a)) throw new Error('missing: ' + l); return s.replace(a, () => b); };

fs.writeFileSync('supabase/migrations/20261104000000_profile_address.sql', "-- A customer's address on their profile, so it can pre-fill the form when they claim a price (the ZIP code is already there).\nalter table public.profiles add column if not exists street_address text;\nalter table public.profiles add column if not exists city text;\nalter table public.profiles add column if not exists state text;\n");

edit('src/lib/googleMaps.ts', (s) => rep(s, "/** Starts loading Google Maps the first time it is used", `/** Loads Google Maps if it has not been (the address boxes use it too) and says whether it is ready to use. */
export function ensureGoogleMaps(): Promise<boolean> {
  return new Promise((resolve) => {
    load();
    if (status === 'ready') return resolve(true);
    if (status === 'no-key' || status === 'error') return resolve(false);
    const done = () => {
      if (status === 'ready') { listeners.delete(done); resolve(true); }
      else if (status === 'no-key' || status === 'error') { listeners.delete(done); resolve(false); }
    };
    listeners.add(done);
  });
}

/** Starts loading Google Maps the first time it is used`, 'ensure'));

edit('src/lib/auth/AuthContext.tsx', (s) => rep(s, "  zip_code: string | null;\n", "  zip_code: string | null;\n  street_address: string | null;\n  city: string | null;\n  state: string | null;\n", 'type'));
edit('src/lib/auth/AuthProvider.tsx', (s) => rep(s, "phone, zip_code, theme_preference", "phone, zip_code, street_address, city, state, theme_preference", 'select'));

edit('src/pages/customer/CustomerProfile.tsx', (s) => {
  s = rep(s, "import AccountSettings from '../../components/account/AccountSettings';", "import AccountSettings from '../../components/account/AccountSettings';\nimport AddressField from '../../components/AddressField';", 'imp');
  s = rep(s, "  const [zip, setZip] = useState(profile?.zip_code ?? '');", "  const [zip, setZip] = useState(profile?.zip_code ?? '');\n  const [street, setStreet] = useState(profile?.street_address ?? '');\n  const [city, setCity] = useState(profile?.city ?? '');\n  const [stateCode, setStateCode] = useState(profile?.state ?? '');", 'state');
  s = rep(s, "!/^d{5}$/.test(zipClean)", "!/^\\d{5}$/.test(zipClean)", 'zip regex');
  s = rep(s, ".update({ display_name: displayName.trim(), phone: phone.trim() || null, zip_code: zipClean || null })", ".update({ display_name: displayName.trim(), phone: phone.trim() || null, zip_code: zipClean || null, street_address: street.trim() || null, city: city.trim() || null, state: stateCode.trim().toUpperCase() || null })", 'update');
  // the address block replaces the lone ZIP box
  const a = s.indexOf('        <div>\n          <label htmlFor="zip"');
  const b = s.indexOf('        <div className="flex items-center gap-4">');
  if (a < 0 || b < 0) throw new Error('zip block');
  const field = "w-full px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] transition-colors";
  s = s.slice(0, a) + `        <div>
          <label htmlFor="street" className="block text-[var(--text-secondary)] text-sm mb-2">Your address</label>
          <AddressField
            id="street"
            value={street}
            onChange={(t) => { setStreet(t); setMessage(null); }}
            onPick={(p) => { setCity(p.city); setStateCode(p.state); setZip(p.zip.slice(0, 5)); setMessage(null); }}
            placeholder="Start typing your street address"
            className="${field}"
          />
          <div className="grid grid-cols-[2fr_1fr_1fr] gap-3 mt-3">
            <input type="text" aria-label="City" value={city} onChange={(e) => { setCity(e.target.value); setMessage(null); }} className="${field}" placeholder="City" autoComplete="address-level2" />
            <input type="text" aria-label="State" maxLength={2} value={stateCode} onChange={(e) => { setStateCode(e.target.value.toUpperCase()); setMessage(null); }} className="${field}" placeholder="CA" autoComplete="address-level1" />
            <input id="zip" type="text" aria-label="ZIP code" inputMode="numeric" maxLength={5} value={zip} onChange={(e) => { setZip(e.target.value.replace(/\\D/g, '')); setMessage(null); }} className="${field}" placeholder="91941" autoComplete="postal-code" />
          </div>
          <p className="text-xs text-[var(--text-faint)] mt-1">Fills in the form when you claim a price (you can change it there if the job is at a different address), and the painters map opens on your area.</p>
        </div>

` + s.slice(b);
  return s;
});

edit('src/pages/QuoteResults.tsx', (s) => {
  s = rep(s, "  const [streetAddress, setStreetAddress] = useState('');\n  const [city, setCity] = useState('');\n  const [state_, setState_] = useState(ctx.state || '');",
    "  // the address on their profile pre-fills the property's, unless it is in another ZIP than the price was worked out for\n  const homeHere = !!profile?.street_address && (!profile.zip_code || profile.zip_code === ctx.zipCode);\n  const [streetAddress, setStreetAddress] = useState(homeHere ? profile?.street_address ?? '' : '');\n  const [city, setCity] = useState(homeHere ? profile?.city ?? '' : '');\n  const [state_, setState_] = useState((homeHere ? profile?.state : '') || ctx.state || '');\n  const [pickedZip, setPickedZip] = useState('');", 'state');
  s = rep(s, "  const filled = useRef({ name: false, email: false, phone: false });", "  const filled = useRef({ name: false, email: false, phone: false, address: false });", 'ref');
  s = rep(s, "    if (!filled.current.phone && !phone && profile?.phone) { filled.current.phone = true; setPhone(profile.phone); }", "    if (!filled.current.phone && !phone && profile?.phone) { filled.current.phone = true; setPhone(profile.phone); }\n    if (!filled.current.address && !streetAddress && !city && profile?.street_address && (!profile.zip_code || profile.zip_code === ctx.zipCode)) {\n      filled.current.address = true;\n      setStreetAddress(profile.street_address);\n      setCity(profile.city ?? '');\n      if (profile.state) setState_(profile.state);\n    }", 'effect');
  // the property address comes first, with suggestions
  const a = s.indexOf('              <input placeholder="Full name"');
  const b = s.indexOf('              <div>\n                <label style={{ fontSize: \'0.8rem\'');
  if (a < 0 || b < 0) throw new Error('form block');
  s = s.slice(0, a) + `              <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: 0.4, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Property address (where the painting is)</div>
              <AddressField
                value={streetAddress}
                onChange={(t) => { setStreetAddress(t); setPickedZip(''); }}
                onPick={(p) => { setCity(p.city); if (p.state) setState_(p.state); setPickedZip(p.zip); }}
                placeholder="Street address"
                style={inputStyle}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} style={{ ...inputStyle, flex: 2 }} autoComplete="address-level2" />
                <input placeholder="State" value={state_} onChange={(e) => setState_(e.target.value)} style={{ ...inputStyle, flex: 1 }} autoComplete="address-level1" />
              </div>
              {pickedZip && ctx.zipCode && pickedZip.slice(0, 5) !== ctx.zipCode && (
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Your price was worked out for ZIP {ctx.zipCode}. This address is in {pickedZip.slice(0, 5)}, so the painter will confirm it for the new location.</p>
              )}
              <div style={{ fontSize: '0.8rem', fontWeight: 700, letterSpacing: 0.4, color: 'var(--text-secondary)', textTransform: 'uppercase', marginTop: 6 }}>Your contact info</div>
              <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} autoComplete="name" />
              <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} autoComplete="email" />
              <input placeholder="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} autoComplete="tel" />
` + s.slice(b);
  s = rep(s, "import { useAuth }", "import AddressField from '../components/AddressField';\nimport { useAuth }", 'imp');
  return s;
});

// the iPhone chat window: no "Pick Your Price, Pick Your Painter." once it has expanded; just the Done button on the header colour under the status bar
edit('src/styles/chat-estimator.css', (s) => rep(s, ".chat-estimator-section.keyboard-open .chat-estimator-header p,\n.chat-estimator-section.keyboard-open .chat-input-hint {\n  display: none;\n}", `.chat-estimator-section.keyboard-open .chat-estimator-header p,
.chat-estimator-section.keyboard-open .chat-input-hint,
.chat-estimator-section.keyboard-open .chat-estimator-header h2 {
  display: none;
}

/* with the title gone the header is just a slim bar holding Done */
.chat-estimator-section.keyboard-open .chat-estimator-header {
  padding-top: 6px;
  padding-bottom: 6px;
}
.chat-estimator-section.keyboard-open .chat-estimator-header-row {
  justify-content: flex-end;
  align-items: center;
}`, 'css'));

// signing up with an email must be proven before it opens any project that was claimed with that email
edit('supabase/functions/get-my-projects/index.ts', (s) => {
  s = rep(s, "    const { id: userId, email: userEmail } = userData.user", "    const { id: userId } = userData.user\n    // projects claimed as a guest are matched by email, which only counts once the email is confirmed (otherwise anyone could sign up with someone else's address)\n    const userEmail = userData.user.email_confirmed_at ? userData.user.email : undefined", 'email');
  return s;
});
console.log('ok');
