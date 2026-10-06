-- Undo 20260930070000: the workers' comp pause rule now looks only at the
-- painter's current crew size. Painters can change their crew size freely; if
-- they misrepresent themselves it surfaces when they contract the work.

DROP TRIGGER IF EXISTS trg_set_crew_size_at_signup ON painters;
DROP FUNCTION IF EXISTS set_crew_size_at_signup();

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

ALTER TABLE painters DROP COLUMN IF EXISTS crew_size_at_signup;
