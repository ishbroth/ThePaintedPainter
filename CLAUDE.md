# The Painted Painter: notes for working in this repo

## Demonstration painters must stay in step with the product

`supabase/seed/seedDemoPainters.ts` defines the demonstration painters: complete fake profiles (every profile field, portfolio,
reviews, availability) plus, for the "flagship" painters, jobs and customers in every state (new offers, each step of the dates
conversation, confirmed, completed, a 1-star review). They are real rows marked `painters.is_demo = true`, used to demo the site and to
test every calendar and flow.

**Whenever you change any of the following, update the seed in the same change and re-run `npm run seed:demo`:**

- the painter profile (new, renamed or removed fields on `painters`, the profile page, the signup form, credentials)
- the painter dashboard, schedule, customers, income or rewards pages
- the job lifecycle (`quote_selections` columns or statuses, the dates conversation, deposits, completion, reviews)
- anything a complete painter or a job in some state needs in order to show up correctly

A column that no longer exists makes the seed fail loudly. That is the signal that it needs updating.

Demonstration painters must never reach real customers. Every query that picks painters for a real customer (results, job offers,
outreach, "no painter in range" checks) filters `is_demo = false`. Keep that filter on any new query like it. Their emails use the
reserved `.invalid` domain; `send-email` skips those addresses.

## Other things worth knowing

- The painters map reads `map_painters`, a public table a database trigger keeps in step with `painters` (approved + geocoded only)
  and that is broadcast over realtime. Don't query `painters` directly from the browser for the map.
- Distances between a customer and painters use exact ZIP coordinates from `zip_geocodes` (filled by `_shared/geo.ts`
  `getZipCoords`), not the rough 3-digit centers.
- Removing a painter goes through `_shared/removal.ts` (`removePainter`), never a bare status update, so the snapshot, emails and
  "previously removed" matching all happen. A painter is removed automatically at 3 or more reviews of 2 stars or fewer once those are 3 out of every 10 (or more) of all their reviews (`overRemovalLine` in `removal.ts`).
- Edge functions are deployed by hand: `supabase functions deploy <name>` (add `--no-verify-jwt` for the ones that already use it).
  The site deploys itself from `main` through GitHub Pages.
- Outreach to outside painting companies keeps a directory (`outreach_companies`) and rotates through it (`_shared/outreachPlan.ts`): 7 days
  between invitations to the same company when there are enough others, after 5 invitations without a response a company moves to the back
  of the line (never deleted), never twice in one day, and a company that signs up or unsubscribes leaves the rotation. At most 12 invitations
  per job. `outreach-painters` with `{"dryRunZip":"<zip>"}` (service role) shows the rotation for a ZIP without contacting anyone.
