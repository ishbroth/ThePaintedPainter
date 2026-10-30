-- Painters can choose to keep accepting jobs even while they are booked on a customer's dates (profile > Availability).
-- They are only offered a job when every painter in the area is booked: crews of 3 or more first (any job), crews of 1 to 2 only for small jobs.
ALTER TABLE painters ADD COLUMN IF NOT EXISTS accepts_when_booked boolean NOT NULL DEFAULT false;
