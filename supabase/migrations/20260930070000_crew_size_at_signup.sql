-- Remember the crew size a painter reported when they applied.
--
-- Turning off workers' compensation pauses a painter only if their crew is more
-- than one person. Crew size is editable on the profile, so judging by the
-- current value alone would let someone set it to 1 and then drop their
-- coverage. The pause rule uses the larger of the current and signup values.

ALTER TABLE painters ADD COLUMN IF NOT EXISTS crew_size_at_signup INTEGER;

UPDATE painters SET crew_size_at_signup = crew_size WHERE crew_size_at_signup IS NULL;

CREATE OR REPLACE FUNCTION set_crew_size_at_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.crew_size_at_signup IS NULL THEN
    NEW.crew_size_at_signup := NEW.crew_size;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_crew_size_at_signup ON painters;
CREATE TRIGGER trg_set_crew_size_at_signup
  BEFORE INSERT ON painters
  FOR EACH ROW
  EXECUTE FUNCTION set_crew_size_at_signup();

-- The new column is write-protected from direct client updates like the other
-- vetted fields (same guard as before, plus crew_size_at_signup).
CREATE OR REPLACE FUNCTION protect_painter_approval_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.verified IS DISTINCT FROM OLD.verified
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.application_tasks IS DISTINCT FROM OLD.application_tasks
     OR NEW.admin_message IS DISTINCT FROM OLD.admin_message
     OR NEW.last_reminder_at IS DISTINCT FROM OLD.last_reminder_at
     OR NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at
     OR NEW.crew_size_at_signup IS DISTINCT FROM OLD.crew_size_at_signup
     OR NEW.has_license IS DISTINCT FROM OLD.has_license
     OR NEW.license_number IS DISTINCT FROM OLD.license_number
     OR NEW.license_state IS DISTINCT FROM OLD.license_state
     OR NEW.license_expiration IS DISTINCT FROM OLD.license_expiration
     OR NEW.is_bonded IS DISTINCT FROM OLD.is_bonded
     OR NEW.bonding_company IS DISTINCT FROM OLD.bonding_company
     OR NEW.bond_amount IS DISTINCT FROM OLD.bond_amount
     OR NEW.is_insured IS DISTINCT FROM OLD.is_insured
     OR NEW.insurance_company IS DISTINCT FROM OLD.insurance_company
     OR NEW.policy_number IS DISTINCT FROM OLD.policy_number
     OR NEW.coverage_amount IS DISTINCT FROM OLD.coverage_amount
     OR NEW.has_workers_comp IS DISTINCT FROM OLD.has_workers_comp
     OR NEW.workers_comp_carrier IS DISTINCT FROM OLD.workers_comp_carrier
     OR NEW.certifications IS DISTINCT FROM OLD.certifications
     OR NEW.other_certification IS DISTINCT FROM OLD.other_certification THEN
    RAISE EXCEPTION 'these fields cannot be modified directly';
  END IF;
  RETURN NEW;
END;
$$;
