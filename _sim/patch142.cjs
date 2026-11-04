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
const read = (f) => fs.readFileSync(f, 'utf8').split('\r\n').join('\n');

{
  const o = load('supabase/functions/send-email/index.ts');
  rep(o, "  no_painter_alert: 'A job needs a painter',", "  no_painter_alert: 'A job needs a painter',\n  cold_job_invite: 'A free painting job near you',");
  rep(o, "    case 'no_painter_alert': {\n", read('_sim/snip_cold.txt') + "    case 'no_painter_alert': {\n");
  // these templates escape their own fields (like job_offer_available), so the data is not escaped twice
  rep(o, "const data = type === 'job_offer_available' ? rawData : escapeStrings(rawData)", "const data = type === 'job_offer_available' || type === 'no_painter_alert' || type === 'cold_job_invite' ? rawData : escapeStrings(rawData)");
  rep(o, "isInternal && (type === 'new_review' || type === 'no_painter_alert') && rawData?.subject", "isInternal && (type === 'new_review' || type === 'no_painter_alert' || type === 'cold_job_invite') && rawData?.subject");
  // one-click unsubscribe headers on the invitation
  rep(o, "        reply_to: replyTo,\n        ...(isInternal && Array.isArray(body.attachments)", "        reply_to: replyTo,\n        ...(type === 'cold_job_invite' && rawData?.unsubscribeUrl\n          ? { headers: { 'List-Unsubscribe': `<${String(rawData.unsubscribeUrl)}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } }\n          : {}),\n        ...(isInternal && Array.isArray(body.attachments)");
  save('supabase/functions/send-email/index.ts', o);
}
{
  const o = load('supabase/functions/admin-painter-review/index.ts');
  rep(o, "      return json({ success: true, status: 'approved' })", "      // jobs that were waiting for a painter in this area are offered to them right away\n      await attachOpenJobsToPainter(supabase, { supabaseUrl, serviceRoleKey }, id).catch((err) => console.error('attaching open jobs failed:', err))\n      return json({ success: true, status: 'approved' })");
  // import
  const first = o.t.indexOf("import ");
  const endLine = o.t.indexOf("\n", o.t.lastIndexOf("import ", o.t.indexOf("serve(")));
  o.t = o.t.slice(0, endLine + 1) + "import { attachOpenJobsToPainter } from '../_shared/openJobs.ts'\n" + o.t.slice(endLine + 1);
  save('supabase/functions/admin-painter-review/index.ts', o);
}
console.log('ok');
