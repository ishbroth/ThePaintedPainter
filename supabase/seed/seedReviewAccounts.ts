// Real (not demonstration) accounts for the app store reviewers: one customer and one business (painter), already confirmed,
// with every profile field filled in with generic details. Safe to run again: it refreshes the same accounts in place.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... REVIEW_PASSWORD=... npx tsx supabase/seed/seedReviewAccounts.ts
//
// The password is read from REVIEW_PASSWORD and is never stored in the repo.
// The business is approved and verified (so its dashboard is fully usable) but its leads are paused with no end date, so real
// customers are never offered jobs by a placeholder company. Un-pause it from the painter dashboard if reviewers need to see offers.

import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { fakePainters } from '../../src/lib/fakePainters.ts';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.REVIEW_PASSWORD;
if (!url || !serviceKey || !password) {
  console.error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and REVIEW_PASSWORD first.');
  process.exit(1);
}
const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const CUSTOMER = { email: 'welpcustomer@yahoo.com', name: 'Welp Customer', phone: '(619) 555-0101' };
const BUSINESS = {
  email: 'welpbusiness@yahoo.com',
  owner: 'Alex Taylor',
  company: 'Welp Painting Co.',
  phone: '(619) 555-0102',
  street: '123 Main St',
  city: 'San Diego',
  state: 'CA',
  zip: '92101',
  latitude: 32.7157,
  longitude: -117.1611,
};

const must = <T extends { error: { message: string } | null }>(r: T, what: string): T => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r;
};
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const dateFromNow = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

/** Create the login (already confirmed), or find it and reset its password and confirmation. */
async function ensureUser(email: string, role: 'customer' | 'painter', displayName: string): Promise<string> {
  const created = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { role, display_name: displayName } });
  if (created.data.user) return created.data.user.id;
  for (let page = 1; page < 50; page++) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) {
      must(await supabase.auth.admin.updateUserById(found.id, { password, email_confirm: true, user_metadata: { role, display_name: displayName } }), `update ${email}`);
      return found.id;
    }
    if (data.users.length < 200) break;
  }
  throw new Error(`could not create or find ${email}: ${created.error?.message}`);
}

async function main() {
  // ---- customer ----
  const customerId = await ensureUser(CUSTOMER.email, 'customer', CUSTOMER.name);
  must(await supabase.from('profiles').upsert({ id: customerId, role: 'customer', display_name: CUSTOMER.name, phone: CUSTOMER.phone }), 'customer profile');
  console.log('customer ready:', CUSTOMER.email, customerId);

  // ---- business ----
  const painterUserId = await ensureUser(BUSINESS.email, 'painter', BUSINESS.owner);
  must(await supabase.from('profiles').upsert({ id: painterUserId, role: 'painter', display_name: BUSINESS.owner, phone: BUSINESS.phone }), 'painter profile');
  const { data: existing } = await supabase.from('painters').select('id').eq('user_id', painterUserId).maybeSingle();
  const painterId = existing?.id ?? randomUUID();
  const base = 1600;
  const row = {
    id: painterId,
    user_id: painterUserId,
    is_demo: false,
    status: 'approved',
    verified: true,
    reviewed_at: daysAgo(30),
    application_tasks: [],
    admin_message: null,
    previously_removed_note: null,
    removed_at: null,
    removal_reason: null,
    company_name: BUSINESS.company,
    owner_name: BUSINESS.owner,
    email: BUSINESS.email,
    phone: BUSINESS.phone,
    street_address: BUSINESS.street,
    city: BUSINESS.city,
    state: BUSINESS.state,
    zip_code: BUSINESS.zip,
    website: 'https://www.example.com/welp-painting',
    years_in_business: 12,
    crew_size: 4,
    accepts_when_booked: false,
    bio: 'Welp Painting Co. is a family-run painting company serving San Diego County. We do interior and exterior repaints, cabinets and trim, with careful prep and a clean job site.',
    external_reviews: {},
    has_license: true,
    license_number: 'WELP-000001',
    license_state: BUSINESS.state,
    license_expiration: dateFromNow(420),
    is_bonded: true,
    bonding_company: 'Sample Surety Co.',
    bond_amount: '$25,000',
    is_insured: true,
    insurance_company: 'Sample Mutual Insurance',
    policy_number: 'WELP-POL-0001',
    coverage_amount: '$1,000,000',
    has_workers_comp: true,
    workers_comp_carrier: 'Sample Workers Comp Fund',
    certifications: ['EPA Lead-Safe Certified'],
    other_certification: null,
    service_types: ['Interior Painting', 'Exterior Painting', 'Cabinet Painting', 'Trim & Doors'],
    service_area_zips: '92101, 92102, 92103, 92104',
    max_project_size: 'medium',
    projects_per_month: 4,
    offers_estimates: true,
    offers_warranty: true,
    warranty_length: '2 years',
    price_1br_full: base,
    price_3br_walls: Math.round(base * 1.2),
    price_3br_trim_doors: Math.round(base * 0.9),
    price_3br_ceilings: Math.round(base * 0.8),
    price_5br_full: Math.round(base * 3.2),
    price_5br_cabinets: Math.round(base * 1.5),
    // paused with no end date: placeholder company, never offered to real customers
    leads_paused: true,
    paused_until: null,
    blackout_dates: [],
    latitude: BUSINESS.latitude,
    longitude: BUSINESS.longitude,
    geocoded_zip: BUSINESS.zip,
  };
  must(await supabase.from('painters').upsert(row, { onConflict: 'id' }), 'painter row');

  // a few generic portfolio photos (the same stock photos the site already uses)
  must(await supabase.from('painter_portfolio').delete().eq('painter_id', painterId), 'clear portfolio');
  const captions = ['Living room repaint', 'Exterior refresh', 'Kitchen and trim'];
  const rows = fakePainters[0].portfolio_images.slice(0, 3).map((storage_path, i) => ({ painter_id: painterId, storage_path, caption: captions[i], created_at: daysAgo(10 + i) }));
  if (rows.length) must(await supabase.from('painter_portfolio').insert(rows), 'portfolio');
  console.log('business ready:', BUSINESS.email, painterUserId, 'painter row', painterId);
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
