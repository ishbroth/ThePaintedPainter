// End-to-end test of the business flow against the live backend, using made-up ".invalid" customers and painters
// (the email function skips those, so no real mail is sent to anyone but the owner's notification inbox).
// Env: SB_URL, SB_SERVICE, SB_ANON, ADMIN_SECRET
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const URL_ = process.env.SB_URL;
const SERVICE = process.env.SB_SERVICE;
const ANON = process.env.SB_ANON;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

const results = [];
let failures = 0;
const note = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};
const expect = (name, cond, detail) => note(name, !!cond, cond ? '' : detail ?? 'unexpected');

async function fn(name, body, token = ANON, method = 'POST') {
  const res = await fetch(`${URL_}/functions/v1/${name}`, {
    method,
    headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${token}` },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });
  let json = null;
  try { json = await res.json(); } catch { /* not json */ }
  return { status: res.status, json };
}
async function getFn(name, query, token = ANON) {
  const res = await fetch(`${URL_}/functions/v1/${name}?${query}`, { headers: { apikey: ANON, Authorization: `Bearer ${token}` } });
  let json = null;
  try { json = await res.json(); } catch { /* */ }
  return { status: res.status, json };
}
async function rest(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${URL_}/rest/v1/${path}`, {
    method,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

const day = 86_400_000;
const iso = (d) => d.toISOString().slice(0, 10);
const plusDays = (n) => iso(new Date(Date.now() + n * day));
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const adminLink = (id) => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return { id, exp, sig: createHmac('sha256', ADMIN_SECRET).update(`${id}.${exp}`).digest('hex') };
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ZIP = '99901'; // Ketchikan, AK: no painters there, so it exercises the "nobody in range" path
const CUSTOMER = { name: 'E2E Test Customer', email: 'e2e.customer@demo.invalid', phone: '(907) 555-0100', streetAddress: '12 Test Street', city: 'Ketchikan', state: 'AK' };
const PAINTER_EMAIL = 'e2e.painter@demo.invalid';
const PAINTER2_EMAIL = 'e2e.painter2@demo.invalid';
const PASSWORD = 'E2e-' + randomBytes(6).toString('hex');
const PHONE = '(907) 555-0199';
const LICENSE = 'E2E-LIC-777';

const painterForm = (company, street) => ({
  company_name: company, phone: PHONE, street_address: street, city: 'Ketchikan', state: 'AK', zip_code: ZIP,
  website: 'https://www.example.com/e2e', years_in_business: 9, crew_size: 4,
  has_license: true, license_number: LICENSE, license_state: 'AK', license_expiration: plusDays(400),
  is_bonded: true, bonding_company: 'E2E Surety', bond_amount: '$10,000',
  is_insured: true, insurance_company: 'E2E Insurance', policy_number: 'E2E-POL-1', coverage_amount: '$1,000,000',
  has_workers_comp: true, workers_comp_carrier: 'E2E Comp', certifications: ['EPA Lead-Safe Certified'],
  service_types: ['Interior Painting', 'Exterior Painting'], service_area_zips: ZIP, max_project_size: 'medium', projects_per_month: 4,
  offers_estimates: true, offers_warranty: true, warranty_length: '2 years',
  price_1br_full: 1800, price_3br_walls: 2200, price_3br_trim_doors: 1600, price_3br_ceilings: 1400, price_5br_full: 5600, price_5br_cabinets: 2800,
});

async function signupPainter(email, company, street, owner) {
  const sub = await fn('submit-painter-application', { email, password: PASSWORD, ownerName: owner, painter: painterForm(company, street) });
  if (sub.status !== 200) return { sub };
  const token = randomBytes(32).toString('hex');
  await rest(`painter_signup_requests?email=ilike.${encodeURIComponent(email)}`, { method: 'PATCH', body: { token_hash: sha256(token) } });
  const conf = await fn('confirm-painter-signup', { token });
  return { sub, conf };
}

async function approve(painterId) {
  if (ADMIN_SECRET) {
    const link = adminLink(painterId);
    return fn('admin-painter-review', { ...link, action: 'approve' });
  }
  // SIMULATED owner approval (the signed admin link needs the admin secret): same fields the admin function sets, then the real geocoder
  await rest(`painters?id=eq.${painterId}`, { method: 'PATCH', body: { status: 'approved', verified: true, reviewed_at: new Date().toISOString(), application_tasks: [] } });
  await fn('geocode-painter', { all: true }, SERVICE);
  return { status: 200, json: { status: 'approved' } };
}

async function signIn(email) {
  const res = await fetch(`${URL_}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }),
  });
  const json = await res.json();
  return json.access_token ?? null;
}

async function claim(selectionType, price, priceToken, extra = {}) {
  return fn('submit-quote-claim', {
    selectionType, guaranteedPrice: price, quoteZip: ZIP, customer: CUSTOMER, timeline: 'flexible', timelineLabel: 'Flexible',
    qa: [{ question: 'What are we painting?', answer: 'Living room and hallway walls (E2E test)' }],
    conversation: ['I want my living room and hallway painted'], breakdown: [{ description: 'Interior walls', amount: price }],
    timing: { timeline: 'flexible', flexible: true }, priceToken, ...extra,
  });
}

let currentJobId = null;
const contract = (body, token) => fn('contract', { jobId: currentJobId, ...body }, token);
const uploadedPaths = [];

async function main() {
  // ---------------------------------------------------------------------------------------------------------------
  console.log('\n== A. Customer, no painter in range, mystery painter ==');
  const resA = await fn('painter-results', { ctx: { zipCode: ZIP, timeline: 'flexible', datesFlexible: true }, baseTotal: 3200 });
  expect('A1 results: no real painters in a ZIP with none, mystery price signed', resA.status === 200 && resA.json.painters.length === 0 && resA.json.mystery?.priceToken, JSON.stringify(resA.json).slice(0, 120));

  const demoCheck = await fn('painter-results', { ctx: { zipCode: '91941', timeline: 'flexible', datesFlexible: true }, baseTotal: 3200 });
  expect('A2 results in La Mesa (where 4 demo painters live): demo painters are NOT shown to a real customer', demoCheck.status === 200 && demoCheck.json.painters.length === 0, `${demoCheck.json?.painters?.length} shown`);

  const claimA = await claim('guaranteed', 3200, resA.json.mystery.priceToken);
  expect('A3 mystery claim with nobody in range: "no painters" popup answer', claimA.status === 200 && claimA.json.noPainters === true, JSON.stringify(claimA.json).slice(0, 150));
  const jobA = (await rest(`quote_selections?id=eq.${claimA.json.quoteSelectionId}&select=*`))[0];
  currentJobId = jobA.id;
  expect('A4 job saved, waiting for a painter', jobA?.status === 'searching_painter', jobA?.status);
  await sleep(1500);
  const noLeadsYet = await rest(`outreach_leads?job_id=eq.${jobA.id}&select=id`);
  expect('A5 outreach did NOT contact real companies for a test customer (guard)', Array.isArray(noLeadsYet) && noLeadsYet.length === 0, `${noLeadsYet.length} leads`);

  const fakeCompanies = [1, 2, 3].map((n) => ({ name: `E2E Fake Painting Co ${n}`, email: `e2e.fake${n}@demo.invalid`, website: `https://www.example.com/fake${n}`, phone: '(907) 555-01' + n }));
  const outreach = await fn('outreach-painters', { jobId: jobA.id, testPlaces: fakeCompanies }, SERVICE);
  expect('A6 outreach invites the 3 fake companies', outreach.json?.ok && outreach.json.invited === 3, JSON.stringify(outreach.json));
  const leads = await rest(`outreach_leads?job_id=eq.${jobA.id}&select=company_name,email,invite_token,status`);
  expect('A7 3 invitation records with tokens', Array.isArray(leads) && leads.length === 3 && leads.every((l) => l.invite_token), JSON.stringify(leads).slice(0, 120));
  const again = await fn('outreach-painters', { jobId: jobA.id, testPlaces: fakeCompanies }, SERVICE);
  expect('A8 running outreach again does not re-invite anyone', again.json?.ok && again.json.invited === 0, JSON.stringify(again.json));
  const unsub = await getFn('outreach-unsubscribe', `token=${leads[0].invite_token}`);
  const optouts = await rest(`outreach_optouts?email=eq.${encodeURIComponent(leads[0].email)}&select=email`);
  expect('A9 one-click unsubscribe records the opt-out', unsub.status < 400 && optouts.length === 1, `status ${unsub.status}`);

  // ---------------------------------------------------------------------------------------------------------------
  console.log('\n== B. Painter signs up from the invitation, gets approved, and the waiting job is offered ==');
  const su = await signupPainter(PAINTER_EMAIL, 'E2E Test Painting', '500 Test Way', 'Pat Painter');
  expect('B1 painter submits the application form', su.sub.status === 200 && su.sub.json?.success, JSON.stringify(su.sub.json));
  expect('B2 confirming the email creates the account and a pending painter record', su.conf?.status === 200 && su.conf.json?.success, JSON.stringify(su.conf?.json));
  const painter = (await rest(`painters?email=eq.${encodeURIComponent(PAINTER_EMAIL)}&select=*`))[0];
  expect('B3 painter row is pending, not a demo, no removal flag', painter?.status === 'pending' && painter.is_demo === false && !painter.previously_removed_note, JSON.stringify({ s: painter?.status, d: painter?.is_demo }));
  const mapBefore = await rest(`map_painters?id=eq.${painter.id}&select=id`);
  expect('B4 a pending painter is NOT on the map', mapBefore.length === 0);

  const appr = await approve(painter.id);
  expect('B5 owner approves (signed admin link)', appr.status === 200 && appr.json?.status === 'approved', JSON.stringify(appr.json));
  const painterAfter = (await rest(`painters?id=eq.${painter.id}&select=status,verified,latitude,longitude`))[0];
  expect('B6 approved painter gets an exact map position', painterAfter.status === 'approved' && painterAfter.latitude && painterAfter.longitude, JSON.stringify(painterAfter));
  const mapAfter = await rest(`map_painters?id=eq.${painter.id}&select=company_name,latitude,longitude`);
  expect('B7 the painter appears on the map instantly (map_painters row)', mapAfter.length === 1, JSON.stringify(mapAfter));
  const zg = await rest(`zip_geocodes?zip=eq.${ZIP}&select=zip,latitude,longitude`);
  expect('B8 the ZIP was geocoded by Google and cached', zg.length === 1 && Math.abs(zg[0].latitude - 55.34) < 0.5, JSON.stringify(zg));

  if (!ADMIN_SECRET) {
    // SIMULATED hand-off (the real one runs inside the admin approval): offer the waiting job to the new painter
    await rest(`quote_selections?id=eq.${jobA.id}&status=eq.searching_painter`, { method: 'PATCH', body: { status: 'offer_sent', notified_painters: [painter.id], offer_sent_at: new Date().toISOString() } });
  }
  const jobA2 = (await rest(`quote_selections?id=eq.${jobA.id}&select=status,notified_painters,claim_token,customer_confirm_token`))[0];
  expect(`B9 ${ADMIN_SECRET ? '' : '(simulated hand-off) '}the job that was waiting is offered to the newly approved painter`, jobA2.status === 'offer_sent' && (jobA2.notified_painters ?? []).includes(painter.id), JSON.stringify({ s: jobA2.status, n: jobA2.notified_painters }));

  const jwt = await signIn(PAINTER_EMAIL);
  expect('B10 painter can sign in', !!jwt);
  const projects = await getFn('get-painter-projects', '', jwt);
  expect('B11 the offer shows in the painter dashboard (Incoming Offers)', projects.status === 200 && projects.json.offers.some((o) => o.id === jobA.id), JSON.stringify(projects.json).slice(0, 150));

  // ---------------------------------------------------------------------------------------------------------------
  console.log('\n== C. Painter accepts, they agree on dates, customer pays the deposit ==');
  const acc = await fn('claim-job', { token: jobA2.claim_token, painterId: painter.id });
  expect('C1 painter accepts the job', acc.status === 200 && !acc.json?.error, JSON.stringify(acc.json));
  const draftView = await contract({ action: 'get', jobId: jobA.id }, jwt);
  expect('C1a accepting the job starts the painter\'s contract draft (version 1, only the painter sees it)', draftView.status === 200 && draftView.json.role === 'painter' && draftView.json.versions.length === 1 && draftView.json.versions[0].status === 'draft', JSON.stringify(draftView.json).slice(0, 160));
  const draftText = JSON.stringify(draftView.json.versions[0].terms.sections);
  expect('C1b the draft contains the job details, the painter\'s company name and the marketplace/indemnity clauses', /E2E Test Painting/.test(draftText) && /not a contractor/.test(draftText) && /indemnify/i.test(draftText) && /Walls|Interior walls/.test(draftText), draftText.slice(0, 120));
  expect('C1c before the deposit the painter sees only the customer\'s first name, no address', draftView.json.parties.customer.name === 'E2E' && !draftView.json.parties.customer.address, JSON.stringify(draftView.json.parties.customer));
  const noAccess = await contract({ action: 'get', token: 'not-a-real-token' });
  expect('C1d a wrong token opens nothing', noAccess.status === 404, `status ${noAccess.status}`);
  const anon = await contract({ action: 'get', jobId: jobA.id });
  expect('C1e a visitor with no login or token is refused', anon.status === 403, `status ${anon.status}`);
  // the painter prepares their own terms and attaches their own document before dates are agreed
  const upSlot = await contract({ action: 'upload_url', filename: 'My Company Contract.pdf', size: 600 }, jwt);
  expect('C1f the painter gets an upload slot for their own PDF/Word contract', upSlot.status === 200 && upSlot.json.path?.startsWith(jobA.id + '/'), JSON.stringify(upSlot.json).slice(0, 120));
  const badType = await contract({ action: 'upload_url', filename: 'virus.exe', size: 600 }, jwt);
  expect('C1g other file types are refused', badType.status === 400, `status ${badType.status}`);
  const storage = createClient(URL_, ANON, { auth: { persistSession: false } });
  const pdfBytes = new TextEncoder().encode('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
  const upl = await storage.storage.from(upSlot.json.bucket).uploadToSignedUrl(upSlot.json.path, upSlot.json.token, new Blob([pdfBytes], { type: 'application/pdf' }));
  uploadedPaths.push(upSlot.json.path);
  expect('C1h the document uploads', !upl.error, upl.error?.message);
  const saved = await contract({ action: 'save_draft', scopeNotes: 'E2E: includes the hallway closet', specialTerms: 'E2E: balance by check or card.', warranty: '', changeOrders: [], documentPath: upSlot.json.path, documentName: 'My Company Contract.pdf', documentSize: pdfBytes.length }, jwt);
  const v1draft = saved.json?.versions?.find((v) => v.status === 'draft');
  expect('C1i the draft now has the painter\'s notes, terms and attached document', saved.status === 200 && v1draft?.document?.name === 'My Company Contract.pdf' && /closet/.test(JSON.stringify(v1draft.terms.sections)) && /balance by check/.test(JSON.stringify(v1draft.terms.sections)), JSON.stringify(saved.json).slice(0, 160));
  const earlySend = await contract({ action: 'send', changeSummary: '' }, jwt);
  expect('C1j sending before dates are agreed is refused (it goes out automatically when they are)', earlySend.status === 409, `status ${earlySend.status}`);

  const start = plusDays(14);
  const end = plusDays(24);
  const offerDates = await fn('painter-dates', { token: jobA2.claim_token, painterId: painter.id, action: 'offer', mode: 'exact', windows: [{ start, end }], note: 'E2E test window', confirmRealistic: true });
  expect('C2 painter sends available dates', offerDates.status === 200 && !offerDates.json?.error, JSON.stringify(offerDates.json));
  const view = await getFn('get-job-by-token', `token=${jobA2.customer_confirm_token}`);
  expect('C3 customer confirm page shows the painter offer, no contact details yet', view.status === 200 && view.json.dateState === 'painter_offered' && !view.json.painter?.email, JSON.stringify(view.json).slice(0, 150));
  const agree = await fn('customer-dates', { token: jobA2.customer_confirm_token, action: 'accept', windowIndex: 0 });
  expect('C4 customer accepts the dates', agree.status === 200 && !agree.json?.error, JSON.stringify(agree.json));
  const agreed = (await rest(`quote_selections?id=eq.${jobA.id}&select=date_state,scheduled_date,scheduled_end_date,deposit_amount`))[0];
  expect('C5 dates are agreed and scheduled', agreed.date_state === 'agreed' && !!agreed.scheduled_date, JSON.stringify(agreed));
  const gate1 = await getFn('get-job-by-token', `token=${jobA2.customer_confirm_token}`);
  expect('C5a agreeing the dates sends the contract to the customer: waiting, not yet accepted', gate1.json?.contract?.pending === true && gate1.json.contract.ok === false, JSON.stringify(gate1.json?.contract));
  const early = await fn('create-checkout-session', { confirmToken: jobA2.customer_confirm_token });
  expect('C5b the deposit cannot be paid before the contract is accepted', early.status === 409 && early.json?.code === 'contract_required', JSON.stringify(early.json));
  const custView = await contract({ action: 'get', token: jobA2.customer_confirm_token });
  const sentV = custView.json?.versions?.find((v) => v.status === 'sent');
  expect('C5c the customer sees the contract (full name and address are theirs), with the painter\'s attached document', custView.status === 200 && custView.json.role === 'customer' && !!sentV && sentV.document?.name === 'My Company Contract.pdf' && custView.json.parties.customer.address, JSON.stringify(custView.json).slice(0, 160));
  const docLink = await contract({ action: 'document_url', versionId: sentV.id, token: jobA2.customer_confirm_token });
  const docBytes = docLink.json?.url ? new Uint8Array(await (await fetch(docLink.json.url)).arrayBuffer()) : null;
  expect('C5d the customer can open the painter\'s own document', !!docBytes && docBytes.length === pdfBytes.length, `${docBytes?.length} vs ${pdfBytes.length}`);
  const painterNoAccept = await contract({ action: 'accept', versionId: sentV.id, name: 'Pat Painter', agree: true }, jwt);
  expect('C5e the painter cannot accept their own contract', painterNoAccept.status === 403, `status ${painterNoAccept.status}`);
  const noName = await contract({ action: 'accept', versionId: sentV.id, name: 'x', agree: true, token: jobA2.customer_confirm_token });
  expect('C5f accepting needs a typed name and the box ticked', noName.status === 400, `status ${noName.status}`);
  const accepted = await contract({ action: 'accept', versionId: sentV.id, name: 'E2E Test Customer', agree: true, token: jobA2.customer_confirm_token });
  expect('C5g the customer accepts the contract with a typed signature', accepted.status === 200 && accepted.json.inForceVersionId === sentV.id, JSON.stringify(accepted.json).slice(0, 140));
  const row = (await rest(`job_contracts?id=eq.${sentV.id}&select=status,accepted_name,accepted_ip,responded_at`))[0];
  expect('C5h the acceptance is recorded (name, time, IP)', row?.status === 'accepted' && row.accepted_name === 'E2E Test Customer' && !!row.responded_at && !!row.accepted_ip, JSON.stringify(row));
  const gate2 = await getFn('get-job-by-token', `token=${jobA2.customer_confirm_token}`);
  expect('C5i now the deposit step is open', gate2.json?.contract?.ok === true, JSON.stringify(gate2.json?.contract));
  const checkout = await fn('create-checkout-session', { confirmToken: jobA2.customer_confirm_token });
  expect('C6 deposit checkout session is created with Stripe (not paid)', checkout.status === 200 && String(checkout.json?.url).startsWith('https://checkout.stripe.com'), JSON.stringify(checkout.json).slice(0, 120));
  // Paying needs a real card; apply the same change the Stripe webhook makes after a successful payment.
  await rest(`quote_selections?id=eq.${jobA.id}&status=eq.painter_accepted`, { method: 'PATCH', body: { deposit_status: 'paid', status: 'confirmed', confirmed_at: new Date().toISOString() } });
  const afterPay = await getFn('get-job-by-token', `token=${jobA2.customer_confirm_token}`);
  expect('C7 (payment simulated) job is confirmed and the customer now sees the painter\'s contact details', afterPay.json?.status === 'confirmed' && !!afterPay.json?.painter?.email, JSON.stringify(afterPay.json?.painter));
  const paidView = await contract({ action: 'get', jobId: jobA.id }, jwt);
  expect('C7a once the deposit is paid the painter sees the customer\'s full name and address in the contract', !!paidView.json?.parties?.customer?.address && /E2E Test Customer/.test(paidView.json.parties.customer.name), JSON.stringify(paidView.json?.parties?.customer));
  const changeWithoutSummary = await (async () => { await contract({ action: 'save_draft', scopeNotes: 'E2E: includes the hallway closet', specialTerms: '', warranty: '', changeOrders: [{ description: 'Paint the garage door', amount: 180 }] }, jwt); return contract({ action: 'send', changeSummary: '' }, jwt); })();
  expect('C7b a change notice must say what changed', changeWithoutSummary.status === 400, `status ${changeWithoutSummary.status}`);
  const sentUpdate = await contract({ action: 'send', changeSummary: 'Added the garage door for $180.' }, jwt);
  const v2 = sentUpdate.json?.versions?.find((v) => v.version === 2);
  expect('C7c the painter sends a change notice (version 2, +$180)', sentUpdate.status === 200 && v2?.status === 'sent' && v2.totals.total === jobA.guaranteed_price + 180, JSON.stringify(sentUpdate.json).slice(0, 160));
  const stillGate = await getFn('get-job-by-token', `token=${jobA2.customer_confirm_token}`);
  expect('C7d version 1 stays in force while the update waits for the customer', stillGate.json?.contract?.pending === true && sentUpdate.json.inForceVersionId === sentV.id, JSON.stringify(stillGate.json?.contract));
  const declined = await contract({ action: 'decline', versionId: v2.id, note: 'E2E: please keep the original price', token: jobA2.customer_confirm_token });
  expect('C7e the customer can decline the update with a note; version 1 is still in force', declined.status === 200 && declined.json.inForceVersionId === sentV.id && !declined.json.pendingVersionId, JSON.stringify(declined.json).slice(0, 140));
  const note = await rest(`notifications?user_id=eq.${painter.user_id}&type=eq.contract_declined&select=body`);
  expect('C7f the painter is told, with the customer\'s note', note.length === 1 && /original price/.test(note[0].body), JSON.stringify(note));
  await contract({ action: 'save_draft', scopeNotes: 'E2E: includes the hallway closet', specialTerms: '', warranty: '', changeOrders: [{ description: 'Paint the garage door', amount: 150 }] }, jwt);
  const resent = await contract({ action: 'send', changeSummary: 'Garage door, now $150.' }, jwt);
  const v3 = resent.json?.versions?.find((v) => v.version === 3);
  const acc3 = await contract({ action: 'accept', versionId: v3.id, name: 'E2E Test Customer', agree: true, token: jobA2.customer_confirm_token });
  expect('C7g the painter sends a revised change and the customer accepts it: version 3 is in force at +$150', acc3.status === 200 && acc3.json.inForceVersionId === v3.id && acc3.json.versions.find((x) => x.id === v3.id).totals.total === jobA.guaranteed_price + 150, JSON.stringify(acc3.json).slice(0, 140));
  const hist = acc3.json.versions.map((v) => v.status).join(',');
  expect('C7h the full history is kept (accepted v1 replaced, declined v2 kept, v3 accepted)', hist === 'superseded,declined,accepted', hist);
  const dashList = await getFn('get-painter-projects', '', jwt);
  expect('C7i the painter\'s project list shows the contract as accepted', dashList.json?.confirmed?.find((j) => j.id === jobA.id)?.contract?.accepted === true, JSON.stringify(dashList.json?.confirmed?.find((j) => j.id === jobA.id)?.contract));
  const sched = await getFn('get-painter-business', '', jwt);
  expect('C8 painter\'s schedule shows the confirmed job', sched.status === 200 && sched.json.schedule.some((s) => s.id === jobA.id), JSON.stringify(sched.json).slice(0, 120));

  // ---------------------------------------------------------------------------------------------------------------
  console.log('\n== D. Painter finishes, customer reviews, rewards and income update ==');
  const done = await fn('mark-job-completed', { jobId: jobA.id }, jwt);
  expect('D1 painter marks the job completed', done.status === 200 && done.json?.success, JSON.stringify(done.json));
  const jobDone = (await rest(`quote_selections?id=eq.${jobA.id}&select=status,completed_at,review_token`))[0];
  expect('D2 job is completed and a review link exists', jobDone.status === 'completed' && !!jobDone.review_token);
  const rev = await fn('submit-review', { token: jobDone.review_token, rating: 5, title: 'E2E great job', body: 'Everything went smoothly (test).' });
  expect('D3 customer submits a 5-star review', rev.status === 200 && rev.json?.success, JSON.stringify(rev.json));
  const dup = await fn('submit-review', { token: jobDone.review_token, rating: 5 });
  expect('D4 the same review link cannot be used twice', dup.status === 409, `status ${dup.status}`);
  const mapRating = await rest(`map_painters?id=eq.${painter.id}&select=avg_rating,review_count`);
  expect('D5 the map shows the new rating instantly', mapRating[0]?.review_count === 1 && Number(mapRating[0].avg_rating) === 5, JSON.stringify(mapRating));
  const biz = await getFn('get-painter-business', '', jwt);
  const payout = Number(jobA.painter_payout_amount);
  expect('D6 income, customers and rewards: earned = payout, 1 customer, first-review badge', biz.json?.income?.totalEarned === payout && biz.json.customers.length === 1 && biz.json.rewards.earned.some((a) => a.kind === 'reviews' && a.threshold === 1), JSON.stringify({ e: biz.json?.income?.totalEarned, p: payout, c: biz.json?.customers?.length, r: biz.json?.rewards?.earned }));
  const pj = await getFn('get-painter-projects', '', jwt);
  expect('D7 dashboard shows 1 completed job, total earnings, rating 5', pj.json?.completed?.length === 1 && pj.json.totalEarnings === payout && pj.json.rating.avgRating === 5, JSON.stringify({ c: pj.json?.completed?.length, t: pj.json?.totalEarnings, r: pj.json?.rating }));

  // ---------------------------------------------------------------------------------------------------------------
  console.log('\n== F. A second customer in the same area: painter shown in results, mystery and specific-painter claims reach them ==');
  const resF = await fn('painter-results', { ctx: { zipCode: ZIP, timeline: 'flexible', datesFlexible: true }, baseTotal: 2800 });
  const listed = resF.json?.painters?.find((p) => p.id === painter.id);
  expect('F1 the approved painter is listed with a price, a distance and a signed price token', !!listed && listed.priceToken && listed.price > 0, JSON.stringify(resF.json?.painters?.[0]).slice(0, 160));
  const claimF = await claim('guaranteed', 2800, resF.json.mystery.priceToken, { customer: { ...CUSTOMER, name: 'E2E Second Customer', email: 'e2e.customer2@demo.invalid' } });
  expect('F2 mystery claim with a painter in range: offered to that painter', claimF.status === 200 && claimF.json?.notifiedCount === 1 && !claimF.json?.noPainters, JSON.stringify(claimF.json));
  const claimG = await claim('specific_painter', listed.price, listed.priceToken, { selectedPainterId: painter.id, customer: { ...CUSTOMER, name: 'E2E Third Customer', email: 'e2e.customer3@demo.invalid' } });
  expect('F3 choosing that specific painter also reaches them', claimG.status === 200 && claimG.json?.notifiedCount === 1, JSON.stringify(claimG.json));
  const decl = await fn('decline-job', { token: (await rest(`quote_selections?id=eq.${claimF.json.quoteSelectionId}&select=claim_token`))[0].claim_token, painterId: painter.id });
  expect('F4 painter can decline an offer', decl.status === 200 && !decl.json?.error, JSON.stringify(decl.json).slice(0, 140));

  // ---------------------------------------------------------------------------------------------------------------
  console.log('\n== E. Three low reviews remove the painter, and a returning applicant is flagged ==');
  const jobs = [];
  for (let n = 1; n <= 3; n++) {
    const row = {
      quote_zip: ZIP, customer_name: `E2E Unhappy ${n}`, customer_email: `e2e.unhappy${n}@demo.invalid`, customer_phone: '(907) 555-0111',
      selection_type: 'guaranteed', guaranteed_price: 2000, selected_painter_price: 2000, painter_payout_amount: 1800, status: 'completed',
      accepted_by: painter.id, accepted_at: new Date().toISOString(), completed_at: new Date().toISOString(), date_state: 'agreed', phase_label: `E2E job ${n}`,
    };
    const [r] = await rest('quote_selections', { method: 'POST', body: row });
    jobs.push(r);
  }
  let removedAfter = [];
  for (let i = 0; i < 3; i++) {
    const r = await fn('submit-review', { token: jobs[i].review_token, rating: i === 0 ? 1 : 2, title: 'E2E not happy', body: 'Test low review ' + (i + 1) });
    expect(`E${i + 1} low review ${i + 1} accepted`, r.status === 200, JSON.stringify(r.json));
    const st = (await rest(`painters?id=eq.${painter.id}&select=status`))[0].status;
    removedAfter.push(st);
    if (i === 0) {
      const follow = await rest(`notifications?user_id=eq.${painter.user_id}&type=eq.review_followup&select=title,body`);
      expect('E4 first 1-star review puts "A customer wrote a 1-star review about you" in the painter\'s pending items', follow.length === 1 && /1-star review/.test(follow[0].title), JSON.stringify(follow));
    }
  }
  expect('E5 painter is still in the network after 1 and 2 low reviews, removed on the 3rd', removedAfter[0] === 'approved' && removedAfter[1] === 'approved' && removedAfter[2] === 'removed', JSON.stringify(removedAfter));
  const mapGone = await rest(`map_painters?id=eq.${painter.id}&select=id`);
  expect('E6 the removed painter disappeared from the map instantly', mapGone.length === 0);
  const snap = await rest(`removed_painters?painter_id=eq.${painter.id}&select=reason,phone_key,license_key,address_key`);
  expect('E7 a removal snapshot was kept (reason bad_reviews, phone, license, address)', snap.length === 1 && snap[0].reason === 'bad_reviews' && snap[0].phone_key && snap[0].license_key && snap[0].address_key, JSON.stringify(snap));
  const resAfter = await fn('painter-results', { ctx: { zipCode: ZIP, timeline: 'flexible', datesFlexible: true }, baseTotal: 2800 });
  expect('E8 the removed painter is gone from customer results', !resAfter.json?.painters?.some((p) => p.id === painter.id));
  const ach = await rest(`painter_achievements?painter_id=eq.${painter.id}&select=kind,threshold`);
  expect('E9 low reviews did not count toward review rewards (only the 5-star did)', ach.filter((a) => a.kind === 'reviews').length === 1, JSON.stringify(ach));
  const blocked = await fn('submit-painter-application', { email: PAINTER_EMAIL, password: PASSWORD, ownerName: 'Pat Painter', painter: painterForm('E2E Test Painting', '500 Test Way') });
  expect('E10 the removed painter cannot just re-register with the same email', blocked.status === 403, `status ${blocked.status}`);

  const su2 = await signupPainter(PAINTER2_EMAIL, 'E2E Reborn Painting', '500 Test Way', 'Pat Painter');
  expect('E11 someone with the same phone, license, address and name applies with a new email', su2.conf?.status === 200, JSON.stringify(su2.conf?.json ?? su2.sub?.json));
  const painter2 = (await rest(`painters?email=eq.${encodeURIComponent(PAINTER2_EMAIL)}&select=id,status,previously_removed_note`))[0];
  expect('E12 the application is flagged "previously removed" (the owner\'s email says so)', !!painter2?.previously_removed_note && /phone number/.test(painter2.previously_removed_note) && /license number/.test(painter2.previously_removed_note), painter2?.previously_removed_note);

  const appr2 = await approve(painter2.id);
  expect('E13 (for the admin-removal test) owner approves the second painter', appr2.json?.status === 'approved');
  const mapP2 = await rest(`map_painters?id=eq.${painter2.id}&select=id`);
  expect('E14 second painter is on the map', mapP2.length === 1);
  if (ADMIN_SECRET) {
    const link2 = adminLink(painter2.id);
    const rem = await fn('admin-painter-review', { ...link2, action: 'remove', message: 'E2E removal test' });
    expect('E15 owner removes a painter by hand (admin action)', rem.status === 200 && rem.json?.status === 'removed', JSON.stringify(rem.json));
    const mapP2b = await rest(`map_painters?id=eq.${painter2.id}&select=id`);
    expect('E16 and they vanish from the map at once', mapP2b.length === 0);
  } else {
    // the database half of a removal: leaving "approved" takes them off the map immediately
    await rest(`painters?id=eq.${painter2.id}`, { method: 'PATCH', body: { status: 'removed' } });
    const mapP2b = await rest(`map_painters?id=eq.${painter2.id}&select=id`);
    expect('E16 (simulated owner removal) status change takes them off the map at once', mapP2b.length === 0);
  }

  console.log(`\n${results.length - failures}/${results.length} checks passed`);
}

async function cleanup() {
  console.log('\n== Cleanup ==');
  if (uploadedPaths.length) await createClient(URL_, SERVICE, { auth: { persistSession: false } }).storage.from('contract-documents').remove(uploadedPaths);
  const names = 'quote_selections?customer_name=like.E2E*';
  const jobs = await rest(`${names}&select=id`);
  const ids = Array.isArray(jobs) ? jobs.map((j) => j.id) : [];
  const painters = await rest('painters?email=like.e2e.*&select=id,user_id');
  const painterIds = Array.isArray(painters) ? painters.map((p) => p.id) : [];
  const userIds = Array.isArray(painters) ? painters.map((p) => p.user_id).filter(Boolean) : [];
  if (userIds.length) await rest(`reviews?painter_id=in.(${userIds.join(',')})`, { method: 'DELETE' });
  if (userIds.length) await rest(`notifications?user_id=in.(${userIds.join(',')})`, { method: 'DELETE' });
  if (ids.length) await rest(`outreach_leads?job_id=in.(${ids.join(',')})`, { method: 'DELETE' });
  if (ids.length) await rest(`quote_selections?id=in.(${ids.join(',')})`, { method: 'DELETE' });
  if (painterIds.length) await rest(`painter_achievements?painter_id=in.(${painterIds.join(',')})`, { method: 'DELETE' });
  if (painterIds.length) await rest(`removed_painters?painter_id=in.(${painterIds.join(',')})`, { method: 'DELETE' });
  await rest('removed_painters?company_name=like.E2E*', { method: 'DELETE' });
  await rest('outreach_optouts?email=like.e2e.*', { method: 'DELETE' });
  await rest('outreach_leads?email=like.e2e.*', { method: 'DELETE' });
  await rest('painter_signup_requests?email=like.e2e.*', { method: 'DELETE' });
  if (painterIds.length) await rest(`painters?id=in.(${painterIds.join(',')})`, { method: 'DELETE' });
  for (const uid of userIds) await fetch(`${URL_}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
  const left = await rest('painters?email=like.e2e.*&select=id');
  const leftJobs = await rest(`${names}&select=id`);
  console.log(`removed ${ids.length} test jobs and ${painterIds.length} test painters; leftover painters ${left.length}, jobs ${leftJobs.length}`);
}

try {
  await main();
} catch (err) {
  console.error('\nTEST RUN STOPPED:', err);
  failures++;
} finally {
  await cleanup();
}
process.exit(failures ? 1 : 0);
