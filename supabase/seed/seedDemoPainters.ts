// Demonstration painters: complete fake profiles for showing the site off and for testing every flow.
//
//   npm run seed:demo        (needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment)
//
// What it makes (safe to run again any time; it refreshes everything in place and never touches real painters):
//   - Every painter in src/lib/fakePainters.ts plus a few San Diego area ones, as real rows in the database with
//     every profile field filled in (license, insurance, bond, crew, services, prices, bio, portfolio photos,
//     reviews, blackout dates). They are marked is_demo, so they appear on the map and on their profile page but
//     NEVER in a real customer's results, job offers or outreach.
//   - A real login for each (see DEMO_PASSWORD below), so you can sign in as one and use the painter dashboard.
//   - For the FLAGSHIP painters, a full working set of jobs and customers in every state: new offers, accepted jobs
//     at each stage of the dates conversation, confirmed jobs on the calendar, completed jobs over the last seven
//     months (income chart, customers, repeat customers, reviews, rewards), a 1-star review waiting in "Needs your
//     attention", and notifications.
//   - Dates are relative to the day you run it, so run it again whenever the calendar goes stale.
//
// All demo email addresses end in ".invalid" (never deliverable); send-email skips them, so testing can't send real mail.
//
// KEEPING IT CURRENT: this file is the single description of what a complete painter looks like. When the painter
// profile, dashboard, job flow or database changes, change this file in the same commit (see CLAUDE.md). A column
// that no longer exists makes the script fail loudly, which is the signal.
//
// DEMO_PASSWORD (optional): the password for every demo login. A random one is generated and printed if you don't set it.

import { createClient } from '@supabase/supabase-js';
import { createHash, randomBytes } from 'node:crypto';
import { fakePainters, type FakePainter } from '../../src/lib/fakePainters.ts';
import { buildTerms, cleanPainterTerms, type PainterTerms } from '../functions/_shared/contract.ts';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.');
  process.exit(1);
}
const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const password = process.env.DEMO_PASSWORD ?? randomBytes(9).toString('base64url');

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
const DAY = 86_400_000;
const today = new Date();
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysFromNow = (n: number) => iso(new Date(today.getTime() + n * DAY));
const timestampDaysAgo = (n: number, hour = 15) => {
  const d = new Date(today.getTime() - n * DAY);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
};

/** A stable UUID from a name, so re-running updates the same rows. */
function uuidFrom(name: string): string {
  const h = createHash('sha1').update(`tpp-demo:${name}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '');
const must = <T>(result: { data: T | null; error: { message: string } | null }, what: string): T => {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data as T;
};

// ---------------------------------------------------------------------------
// The roster: the fake painters from the old front-end list, plus San Diego area ones near the owner
// ---------------------------------------------------------------------------
interface RosterEntry extends FakePainter {
  flagship: boolean;
}

const extraSanDiego: FakePainter[] = [
  ['La Mesa Brush & Roller', 'Carlos Medina', 'La Mesa', 'CA', '91941', 32.7678, -117.0231, '(619) 555-0111', 14, 6, 4.9, 61],
  ['Harbor City Painting', 'Dana Whitfield', 'San Diego', 'CA', '92101', 32.7157, -117.1611, '(619) 555-0122', 19, 9, 4.7, 142],
  ['East County Pro Painters', 'Mike Brandt', 'El Cajon', 'CA', '92020', 32.7948, -116.9625, '(619) 555-0133', 11, 5, 4.6, 48],
  ['South Bay Coatings', 'Elena Ruiz', 'Chula Vista', 'CA', '91910', 32.6401, -117.0842, '(619) 555-0144', 8, 4, 4.8, 33],
].map(([company_name, owner_name, city, state, zip_code, latitude, longitude, phone, years_experience, crew_size, rating, review_count], i) => ({
  id: uuidFrom(`san-diego-${i}`),
  company_name: company_name as string,
  owner_name: owner_name as string,
  city: city as string,
  state: state as string,
  zip_code: zip_code as string,
  latitude: latitude as number,
  longitude: longitude as number,
  phone: phone as string,
  years_experience: years_experience as number,
  crew_size: crew_size as number,
  is_licensed: true,
  is_insured: true,
  is_bonded: i % 2 === 0,
  license_number: `CA-CSLB-9${i}4${i}210`,
  rating: rating as number,
  review_count: review_count as number,
  bio: `${company_name} has been painting homes in ${city} and the surrounding neighborhoods for ${years_experience} years. Clean prep, careful taping, and a crew that treats your home like their own.`,
  services: ['Interior Painting', 'Exterior Painting', 'Cabinet Painting', 'Drywall Repair', 'Color Consultation', 'Pressure Washing'],
  portfolio_images: fakePainters[1].portfolio_images,
  deals: [],
}));

// The painters that also get a full set of jobs, customers and history to test the dashboard flows with.
const FLAGSHIP_IDS = new Set<string>([
  ...extraSanDiego.map((p) => p.id),
  fakePainters[0].id, // Manhattan Brush Co.
  fakePainters[2].id, // Windy City Coatings
]);

const roster: RosterEntry[] = [...extraSanDiego, ...fakePainters].map((p) => ({ ...p, flagship: FLAGSHIP_IDS.has(p.id) }));

const emailFor = (p: FakePainter) => `demo.${slugOf(p.company_name)}@demo.invalid`;

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------
async function ensureUser(p: RosterEntry): Promise<string> {
  const { data: existing } = await supabase.from('painters').select('user_id').eq('id', p.id).maybeSingle();
  if (existing?.user_id) {
    await supabase.auth.admin.updateUserById(existing.user_id, { password });
    return existing.user_id;
  }
  const email = emailFor(p);
  const created = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'painter', display_name: p.owner_name },
  });
  if (created.data.user) return created.data.user.id;
  // the account exists from an earlier, interrupted run: find it
  for (let page = 1; page < 50; page++) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) {
      await supabase.auth.admin.updateUserById(found.id, { password });
      return found.id;
    }
    if (data.users.length < 200) break;
  }
  throw new Error(`could not create or find the login for ${p.company_name}: ${created.error?.message}`);
}

// ---------------------------------------------------------------------------
// The painter row: EVERY profile field filled in
// ---------------------------------------------------------------------------
function painterRow(p: RosterEntry, userId: string, index: number) {
  const base = 1500 + (index % 7) * 120;
  const size = p.crew_size <= 3 ? 'small' : p.crew_size <= 8 ? 'medium' : 'large';
  const streets = ['Main', 'Oak', 'Maple', 'Cedar', 'Elm', 'Pine'];
  const slug = slugOf(p.company_name);
  return {
    id: p.id,
    user_id: userId,
    is_demo: true,
    status: 'approved',
    verified: true,
    reviewed_at: timestampDaysAgo(120),
    application_tasks: [],
    admin_message: null,
    previously_removed_note: null,
    removed_at: null,
    removal_reason: null,
    // company
    company_name: p.company_name,
    owner_name: p.owner_name,
    email: emailFor(p),
    phone: p.phone,
    street_address: `${100 + ((index * 37) % 880)} ${streets[index % streets.length]} St`,
    city: p.city,
    state: p.state,
    zip_code: p.zip_code,
    website: `https://www.example.com/${slug}`,
    years_in_business: p.years_experience,
    crew_size: p.crew_size,
    bio: p.bio,
    external_reviews: {
      google: { url: `https://www.google.com/maps/search/${encodeURIComponent(p.company_name)}`, rating: p.rating, count: p.review_count },
      yelp: { url: `https://www.yelp.com/search?find_desc=${encodeURIComponent(p.company_name)}`, rating: Math.max(3.5, Math.round((p.rating - 0.2) * 10) / 10), count: Math.round(p.review_count / 3) },
    },
    // credentials
    has_license: p.is_licensed,
    license_number: p.license_number ?? (p.is_licensed ? `DEMO-LIC-${index}` : null),
    license_state: p.state,
    license_expiration: daysFromNow(400 + index * 3),
    is_bonded: p.is_bonded,
    bonding_company: p.is_bonded ? 'Demo Surety Co.' : null,
    bond_amount: p.is_bonded ? '$25,000' : null,
    is_insured: p.is_insured,
    insurance_company: p.is_insured ? 'Demo Mutual Insurance' : null,
    policy_number: p.is_insured ? `DEMO-POL-${10000 + index}` : null,
    coverage_amount: p.is_insured ? '$1,000,000' : null,
    has_workers_comp: p.crew_size > 2,
    workers_comp_carrier: p.crew_size > 2 ? 'Demo Workers Comp Fund' : null,
    certifications: ['EPA Lead-Safe Certified'],
    other_certification: index % 5 === 0 ? 'Master Painters Institute member' : null,
    // services and capacity
    service_types: p.services,
    service_area_zips: `${p.zip_code}, ${String(Number(p.zip_code) + 1).padStart(5, '0')}, ${String(Number(p.zip_code) + 2).padStart(5, '0')}`,
    max_project_size: size,
    projects_per_month: Math.max(2, p.crew_size),
    offers_estimates: true,
    offers_warranty: index % 2 === 0,
    warranty_length: index % 2 === 0 ? '2 years' : null,
    // pricing answers
    price_1br_full: base,
    price_3br_walls: Math.round(base * 1.2),
    price_3br_trim_doors: Math.round(base * 0.9),
    price_3br_ceilings: Math.round(base * 0.8),
    price_5br_full: Math.round(base * 3.2),
    price_5br_cabinets: Math.round(base * 1.5),
    // availability: a booked-out stretch on the calendar for most of them
    leads_paused: false,
    paused_until: null,
    blackout_dates: index % 4 === 3 ? [] : [{ start: daysFromNow(20 + (index % 9)), end: daysFromNow(24 + (index % 9)) }],
    // map position
    latitude: p.latitude,
    longitude: p.longitude,
    geocoded_zip: p.zip_code,
  };
}

// ---------------------------------------------------------------------------
// Reviews: a handful per painter, around the painter's rating
// ---------------------------------------------------------------------------
const REVIEW_TEXT: [number, string, string][] = [
  [5, 'Absolutely phenomenal work', 'The crew was on time, professional, and meticulous about taping and prep. Our rooms look brand new. Would hire again in a heartbeat.'],
  [5, 'Exceeded our expectations', 'They even pointed out some minor wood rot that we were able to fix before painting. Great communication throughout.'],
  [4, 'Very happy with the quality', 'The color consultation was incredibly helpful. Only a minor scheduling hiccup, but they made it right.'],
  [5, 'Third time using this crew', 'Fair pricing, clean work, and they always leave the place spotless. Highly recommend.'],
  [4, 'Solid job', 'The finish is smooth and even, and they were careful around our furniture. Price was reasonable compared to the other quotes.'],
  [3, 'Good result, slow start', 'The painting looks good but the project started later than promised. Communication could have been better.'],
];
const CUSTOMER_NAMES = ['Sarah Mitchell', 'David Lopez', 'Jennifer Kim', 'Marcus Thompson', 'Amy Rodriguez', 'Chris Patel', 'Rachel Green', 'Tom Nguyen', 'Linda Carter', 'Omar Haddad'];

async function seedReviews(p: RosterEntry, userId: string, index: number) {
  // flagship painters get their reviews from their completed jobs (below), tied to the job
  must(await supabase.from('reviews').delete().eq('painter_id', userId).is('project_id', null).select('id'), 'clear demo reviews');
  if (p.flagship) return;
  const high = p.rating >= 4.6;
  const rows = REVIEW_TEXT.slice(0, 4 + (index % 3)).map(([stars, title, body], i) => ({
    painter_id: userId,
    customer_id: null,
    project_id: null,
    rating: high ? Math.max(stars, 4) : stars,
    title,
    body,
    customer_name: CUSTOMER_NAMES[(index + i) % CUSTOMER_NAMES.length],
    created_at: timestampDaysAgo(20 + i * 35 + (index % 10)),
  }));
  must(await supabase.from('reviews').insert(rows).select('id'), 'insert demo reviews');
}

async function seedPortfolio(p: RosterEntry) {
  must(await supabase.from('painter_portfolio').delete().eq('painter_id', p.id).select('id'), 'clear portfolio');
  const captions = ['Living room repaint', 'Exterior refresh', 'Kitchen and trim', 'Primary bedroom', 'Front entry', 'Whole-home interior'];
  const rows = p.portfolio_images.map((storage_path, i) => ({
    painter_id: p.id,
    storage_path, // a full URL: painter-detail serves demonstration photos as they are
    caption: captions[i % captions.length],
    created_at: timestampDaysAgo(10 + i),
  }));
  if (rows.length) must(await supabase.from('painter_portfolio').insert(rows).select('id'), 'insert portfolio');
}

// ---------------------------------------------------------------------------
// Jobs, customers and history for the flagship painters
// ---------------------------------------------------------------------------
interface DemoCustomer {
  name: string;
  email: string;
  phone: string;
}
const customerFor = (n: number): DemoCustomer => {
  const name = CUSTOMER_NAMES[n % CUSTOMER_NAMES.length];
  return { name, email: `${slugOf(name)}@demo.invalid`, phone: `(555) 01${String(10 + (n % 80)).padStart(2, '0')}` };
};

const PHASES = ['Interior repaint', 'Exterior repaint', 'Kitchen cabinets', 'Living room and hallway', 'Whole-home interior', 'Trim and doors', 'Bedrooms'];

type JobStatus = 'offer_sent' | 'painter_accepted' | 'confirmed' | 'completed';

interface JobSpec {
  key: string;
  status: JobStatus;
  customer: number;
  price: number;
  phase: string;
  dateState?: 'awaiting_painter_dates' | 'painter_offered' | 'customer_countered' | 'agreed';
  daysAhead?: number; // scheduled start, for confirmed / agreed
  length?: number; // working days on site
  completedDaysAgo?: number;
  rating?: number; // review left for a completed job
}

const JOBS: JobSpec[] = [
  // new offers waiting to be accepted
  { key: 'offer-1', status: 'offer_sent', customer: 0, price: 2650, phase: PHASES[0] },
  { key: 'offer-2', status: 'offer_sent', customer: 1, price: 5400, phase: PHASES[1] },
  // accepted, at each step of the dates conversation
  { key: 'acc-1', status: 'painter_accepted', customer: 2, price: 1900, phase: PHASES[3], dateState: 'awaiting_painter_dates' },
  { key: 'acc-2', status: 'painter_accepted', customer: 3, price: 3200, phase: PHASES[4], dateState: 'painter_offered', daysAhead: 16, length: 4 },
  { key: 'acc-3', status: 'painter_accepted', customer: 4, price: 2250, phase: PHASES[6], dateState: 'customer_countered', daysAhead: 22, length: 3 },
  { key: 'acc-4', status: 'painter_accepted', customer: 5, price: 2800, phase: PHASES[5], dateState: 'agreed', daysAhead: 12, length: 3 },
  // confirmed and on the calendar
  { key: 'conf-1', status: 'confirmed', customer: 6, price: 3900, phase: PHASES[4], daysAhead: 3, length: 4 },
  { key: 'conf-2', status: 'confirmed', customer: 7, price: 1750, phase: PHASES[2], daysAhead: 9, length: 2 },
  { key: 'conf-3', status: 'confirmed', customer: 8, price: 6100, phase: PHASES[1], daysAhead: 14, length: 6 },
  { key: 'conf-4', status: 'confirmed', customer: 9, price: 2300, phase: PHASES[0], daysAhead: 26, length: 3 },
  // completed over the last seven months (customer 0 and 3 come back: repeat customers)
  { key: 'done-1', status: 'completed', customer: 0, price: 2400, phase: PHASES[0], completedDaysAgo: 8, rating: 5 },
  { key: 'done-2', status: 'completed', customer: 3, price: 3100, phase: PHASES[4], completedDaysAgo: 24, rating: 5 },
  { key: 'done-3', status: 'completed', customer: 6, price: 1850, phase: PHASES[6], completedDaysAgo: 51, rating: 4 },
  { key: 'done-4', status: 'completed', customer: 1, price: 5200, phase: PHASES[1], completedDaysAgo: 83, rating: 5 },
  { key: 'done-5', status: 'completed', customer: 9, price: 2150, phase: PHASES[3], completedDaysAgo: 118, rating: 4 },
  { key: 'done-6', status: 'completed', customer: 3, price: 1600, phase: PHASES[5], completedDaysAgo: 150, rating: 5 },
  { key: 'done-7', status: 'completed', customer: 0, price: 2950, phase: PHASES[0], completedDaysAgo: 181, rating: 5 },
  { key: 'done-8', status: 'completed', customer: 4, price: 2700, phase: PHASES[4], completedDaysAgo: 205 }, // no review left
];

/** Working days (Mon-Fri) from a start date, inclusive of the start. */
function endDateFor(start: string, workingDays: number): string {
  const d = new Date(`${start}T00:00:00Z`);
  let left = workingDays - 1;
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) left--;
  }
  return iso(d);
}

async function seedFlagshipJobs(p: RosterEntry, userId: string, index: number) {
  // clear what an earlier run made for this painter (only jobs belonging to made-up customers)
  const old = must(
    await supabase.from('quote_selections').select('id').like('customer_email', '%@demo.invalid').or(`accepted_by.eq.${p.id},notified_painters.cs.{${p.id}}`),
    'find old demo jobs',
  ) as { id: string }[];
  if (old.length) must(await supabase.from('quote_selections').delete().in('id', old.map((o) => o.id)).select('id'), 'clear old demo jobs');
  must(await supabase.from('reviews').delete().eq('painter_id', userId).select('id'), 'clear flagship reviews');
  must(await supabase.from('notifications').delete().eq('user_id', userId).select('id'), 'clear demo notifications');

  const streets = ['Elm', 'Willow', 'Birch', 'Sunset', 'Highland', 'Park'];
  const reviewRows: Record<string, unknown>[] = [];
  const jobRows = JOBS.map((j, n) => {
    const c = customerFor(j.customer + index); // each flagship has its own mix of customers
    const id = uuidFrom(`job:${p.id}:${j.key}`);
    const payout = Math.round(j.price * 0.9 * 100) / 100;
    const start = j.daysAhead !== undefined ? daysFromNow(j.daysAhead) : null;
    const end = start && j.length ? endDateFor(start, j.length) : null;
    const completedAt = j.completedDaysAgo !== undefined ? timestampDaysAgo(j.completedDaysAgo) : null;
    const confirmedAt = j.status === 'confirmed' || j.status === 'completed' ? timestampDaysAgo((j.completedDaysAgo ?? 0) + 6) : null;

    const row: Record<string, unknown> = {
      id,
      created_at: timestampDaysAgo((j.completedDaysAgo ?? 0) + 14 + n),
      quote_zip: p.zip_code,
      customer_name: c.name,
      customer_email: c.email,
      customer_phone: c.phone,
      customer_street_address: `${210 + n * 17} ${streets[n % streets.length]} Ave`,
      customer_city: p.city,
      customer_state: p.state,
      selection_type: 'guaranteed',
      guaranteed_price: j.price,
      selected_painter_price: j.price,
      painter_payout_amount: payout,
      phase_label: j.phase,
      project_summary: {
        timelineLabel: 'Within the next month',
        qa: [
          { question: 'Which rooms are being painted?', answer: j.phase },
          { question: 'What shape are the walls in?', answer: 'Good condition, a few small nail holes to patch' },
          { question: 'Paint?', answer: "Painter's choice, standard grade, eggshell finish" },
        ],
        conversation: [`I'd like the ${j.phase.toLowerCase()} painted. Everything is empty except a few pieces of furniture we can move.`],
        breakdown: [
          { description: 'Walls', amount: Math.round(j.price * 0.7) },
          { description: 'Ceilings', amount: Math.round(j.price * 0.2) },
          { description: 'Prep and patching', amount: j.price - Math.round(j.price * 0.7) - Math.round(j.price * 0.2) },
        ],
        demo: true,
      },
      photos: [],
      notified_painters: [p.id],
      status: j.status,
      offer_sent_at: timestampDaysAgo((j.completedDaysAgo ?? 0) + 13 + n),
      estimated_days: j.length ?? 3,
      timeline: 'within_month',
      customer_preferred_date: daysFromNow(14),
      deposit_amount: Math.round(j.price * 0.1 * 100) / 100,
      deposit_status: j.status === 'confirmed' || j.status === 'completed' ? 'paid' : 'unpaid',
      date_state: j.dateState ?? (j.status === 'offer_sent' ? 'awaiting_painter_dates' : 'agreed'),
    };
    if (j.status !== 'offer_sent') {
      row.accepted_by = p.id;
      row.accepted_at = timestampDaysAgo((j.completedDaysAgo ?? 0) + 12 + n);
    }
    if (j.status === 'painter_accepted') {
      if (j.dateState === 'painter_offered' && start && end) {
        row.painter_availability = { mode: 'exact', windows: [{ start, end }], note: 'Crew is free this stretch.', estimatedDays: j.length, offeredAt: timestampDaysAgo(2) };
      }
      if (j.dateState === 'customer_countered' && start && end) {
        row.painter_availability = { mode: 'exact', windows: [{ start: daysFromNow(10), end: endDateFor(daysFromNow(10), j.length ?? 3) }], note: '', estimatedDays: j.length, offeredAt: timestampDaysAgo(4) };
        row.customer_counter = { start, end };
      }
      if (j.dateState === 'agreed' && start && end) {
        row.scheduled_date = start;
        row.scheduled_end_date = end;
        row.date_confirmed_at = timestampDaysAgo(1);
      }
    }
    if (j.status === 'confirmed' && start && end) {
      row.scheduled_date = start;
      row.scheduled_end_date = end;
      row.date_confirmed_at = timestampDaysAgo(7);
      row.confirmed_at = confirmedAt;
    }
    if (j.status === 'completed') {
      row.scheduled_date = daysFromNowFrom(completedAt!, -3);
      row.scheduled_end_date = daysFromNowFrom(completedAt!, 0);
      row.confirmed_at = confirmedAt;
      row.completed_at = completedAt;
      row.review_requested_at = completedAt;
      if (j.rating) row.review_submitted_at = timestampDaysAgo((j.completedDaysAgo ?? 0) - 1);
    }

    if (j.status === 'completed' && j.rating) {
      const [, title, body] = REVIEW_TEXT.find(([stars]) => stars === j.rating) ?? REVIEW_TEXT[0];
      reviewRows.push({
        painter_id: userId,
        customer_id: null,
        project_id: id,
        rating: j.rating,
        title,
        body,
        customer_name: c.name,
        created_at: timestampDaysAgo((j.completedDaysAgo ?? 0) - 1),
      });
    }
    return row;
  });

  must(await supabase.from('quote_selections').insert(jobRows).select('id'), 'insert demo jobs');
  await seedContracts(p, index, jobRows);

  // one unhappy customer on the first flagship, so "Needs your attention" and the follow-up flow can be tried
  const firstFlagship = [...FLAGSHIP_IDS][0] === p.id;
  if (firstFlagship) {
    const target = jobRows.find((r) => r.status === 'completed' && !reviewRows.some((rv) => rv.project_id === r.id));
    if (target) {
      reviewRows.push({
        painter_id: userId,
        customer_id: null,
        project_id: target.id,
        rating: 1,
        title: 'Not what I expected',
        body: 'The paint was patchy and one wall was missed. I tried to reach the crew but did not hear back.',
        customer_name: target.customer_name,
        created_at: timestampDaysAgo(3),
      });
      await supabase.from('quote_selections').update({ review_submitted_at: timestampDaysAgo(3) }).eq('id', target.id);
      must(
        await supabase.from('notifications').insert({
          user_id: userId,
          type: 'review_followup',
          title: 'A customer wrote a 1-star review about you',
          body: `${String(target.customer_name).split(' ')[0]} wasn't happy with the job. Reach out and try to resolve it — a quick call or message can often turn this around.`,
          link: '/painter/dashboard/business',
          is_read: false,
          created_at: timestampDaysAgo(3),
        }).select('id'),
        'insert follow-up notification',
      );
    }
  }
  if (reviewRows.length) must(await supabase.from('reviews').insert(reviewRows).select('id'), 'insert flagship reviews');

  const offers = jobRows.filter((r) => r.status === 'offer_sent');
  const confirmed = jobRows.find((r) => r.status === 'confirmed');
  const notes = [
    ...offers.map((o) => ({ type: 'new_offer', title: 'New job offer', body: `${o.phase_label} in ${p.zip_code}`, link: '/painter/dashboard/projects', is_read: false, created_at: timestampDaysAgo(1) })),
    ...(confirmed ? [{ type: 'deposit_paid', title: 'Deposit received', body: `${confirmed.phase_label} is confirmed`, link: '/painter/dashboard/projects', is_read: true, created_at: timestampDaysAgo(5) }] : []),
  ];
  if (notes.length) must(await supabase.from('notifications').insert(notes.map((n) => ({ user_id: userId, ...n }))).select('id'), 'insert demo notifications');
}

// ---------------------------------------------------------------------------
// Contracts for the flagship jobs, in every state the contract screens have to handle
// ---------------------------------------------------------------------------
const DEMO_PDF = [
  '%PDF-1.4',
  '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
  '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
  '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj',
  '4 0 obj<</Length 66>>stream',
  'BT /F1 18 Tf 72 700 Td (Demonstration painter contract terms) Tj ET',
  'endstream endobj',
  '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj',
  'trailer<</Root 1 0 R/Size 6>>',
  '%%EOF',
].join('\n');

async function seedContracts(p: RosterEntry, index: number, jobRows: Record<string, unknown>[]) {
  const painter = {
    company_name: p.company_name,
    has_license: p.is_licensed,
    license_state: p.state,
    is_insured: p.is_insured,
    is_bonded: p.is_bonded,
    offers_warranty: index % 2 === 0,
    warranty_length: index % 2 === 0 ? '2 years' : null,
  };
  const rows: Record<string, unknown>[] = [];
  const make = (job: Record<string, unknown>, version: number, status: string, painterTerms: PainterTerms, extra: Record<string, unknown> = {}) => {
    const terms = buildTerms({ job: job as never, painter, painterTerms: cleanPainterTerms(painterTerms), documentName: (extra.document_name as string | undefined) ?? null });
    rows.push({ job_id: job.id, version, status, terms, painter_terms: painterTerms, ...extra });
  };
  const when = (daysAgo: number) => timestampDaysAgo(daysAgo);
  const accept = (job: Record<string, unknown>, daysAgo: number) => ({ sent_at: when(daysAgo + 1), responded_at: when(daysAgo), accepted_name: String(job.customer_name), accepted_ip: '203.0.113.7', accepted_user_agent: 'demo seed' });

  for (const job of jobRows) {
    const status = job.status as string;
    const state = job.date_state as string;
    if (status === 'painter_accepted') {
      // working copy only until the dates are agreed; once they are, the first version is waiting for the customer
      if (state === 'agreed') make(job, 1, 'sent', { scopeNotes: 'Furniture will be moved to the center of each room and covered.' }, { sent_at: when(1) });
      else make(job, 1, 'draft', {});
    } else if (status === 'confirmed' || status === 'completed') {
      const base: PainterTerms = { scopeNotes: 'Patch and sand nail holes, two coats on walls, one coat on ceilings.', warranty: index % 3 === 0 ? 'Two-year warranty on workmanship; touch-ups free in the first 90 days.' : '' };
      make(job, 1, 'accepted', base, accept(job, 8));
    }
  }

  // an update waiting for the customer, an accepted change order, and a painter's own attached document
  const confirmed = jobRows.filter((j) => j.status === 'confirmed');
  const completed = jobRows.filter((j) => j.status === 'completed');
  if (confirmed[1]) {
    const j = confirmed[1];
    const base: PainterTerms = { scopeNotes: 'Patch and sand nail holes, two coats on walls, one coat on ceilings.' };
    make(j, 2, 'sent', { ...base, changeOrders: [{ description: 'Add the hallway closet doors', amount: 320 }] }, { sent_at: when(1), change_summary: 'Added the hallway closet doors for $320.' });
  }
  if (confirmed[0]) {
    const j = confirmed[0];
    const base: PainterTerms = { scopeNotes: 'Patch and sand nail holes, two coats on walls, one coat on ceilings.' };
    // the first version was superseded by the accepted change
    const v1 = rows.find((r) => r.job_id === j.id && r.version === 1);
    if (v1) v1.status = 'superseded';
    make(j, 2, 'accepted', { ...base, changeOrders: [{ description: 'Paint the garage entry door', amount: 180 }] }, { ...accept(j, 4), change_summary: 'Added the garage entry door for $180.' });
  }
  if (confirmed[2]) {
    const j = confirmed[2];
    const path = `${j.id}/demo-painter-contract.pdf`;
    const up = await supabase.storage.from('contract-documents').upload(path, new TextEncoder().encode(DEMO_PDF), { contentType: 'application/pdf', upsert: true });
    if (up.error) throw new Error(`demo contract document: ${up.error.message}`);
    const v1 = rows.find((r) => r.job_id === j.id && r.version === 1);
    if (v1) {
      const terms = buildTerms({ job: j as never, painter, painterTerms: cleanPainterTerms({}), documentName: 'Company contract terms.pdf' });
      Object.assign(v1, { terms, document_path: path, document_name: 'Company contract terms.pdf', document_size: DEMO_PDF.length });
    }
  }
  // a customer who declined an update, with a note
  if (completed[0]) {
    const j = completed[0];
    make(j, 2, 'declined', { changeOrders: [{ description: 'Extra coat on the trim', amount: 150 }] }, { sent_at: when(10), responded_at: when(9), change_summary: 'Extra coat on the trim for $150.', customer_note: "I'd rather keep the original price, thanks." });
  }

  if (rows.length) must(await supabase.from('job_contracts').insert(rows).select('id'), 'insert demo contracts');
}

/** An ISO date `offsetDays` from a timestamp. */
function daysFromNowFrom(timestamp: string, offsetDays: number): string {
  return iso(new Date(new Date(timestamp).getTime() + offsetDays * DAY));
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
async function main() {
  console.log(`Seeding ${roster.length} demonstration painters (${roster.filter((r) => r.flagship).length} with full job history)...`);
  let index = 0;
  for (const p of roster) {
    const userId = await ensureUser(p);
    must(await supabase.from('painters').upsert(painterRow(p, userId, index), { onConflict: 'id' }).select('id'), `painter ${p.company_name}`);
    await seedPortfolio(p);
    await seedReviews(p, userId, index);
    if (p.flagship) await seedFlagshipJobs(p, userId, index);
    index++;
    if (index % 10 === 0) console.log(`  ${index}/${roster.length}`);
  }
  console.log('\nDone.');
  console.log('Flagship demo logins (full job history):');
  for (const p of roster.filter((r) => r.flagship)) console.log(`  ${emailFor(p)}   ${p.company_name}, ${p.city}`);
  console.log(`Password for every demo login: ${password}`);
  console.log('Every demo painter uses the same password. Their emails end in .invalid, so no real mail is ever sent.');
}

main().catch((err) => {
  console.error('Seed failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
