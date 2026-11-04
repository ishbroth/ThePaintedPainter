-- A customer's address on their profile, so it can pre-fill the form when they claim a price (the ZIP code is already there).
alter table public.profiles add column if not exists street_address text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists state text;
