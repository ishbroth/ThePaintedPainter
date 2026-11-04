const fs = require('fs');
const f = 'src/pages/PainterSignup.tsx';
let t = fs.readFileSync(f, 'utf8');
const crlf = t.includes('\r\n');
t = t.split('\r\n').join('\n');
function rep(a, b) { if (!t.includes(a)) throw new Error('NF ' + a.slice(0, 60)); t = t.replace(a, () => b); }
rep("  const [formData, setFormData] = useState<PainterFormData>(initialFormData);", "  // An invitation email (a free job near the company) links here with the company's name and email already filled in\n  const [formData, setFormData] = useState<PainterFormData>(() => {\n    const params = new URLSearchParams(window.location.search);\n    if (!params.has('invite')) return initialFormData;\n    return { ...initialFormData, companyName: (params.get('company') ?? '').slice(0, 120), email: (params.get('email') ?? '').slice(0, 120) };\n  });");
fs.writeFileSync(f, crlf ? t.split('\n').join('\r\n') : t);
