-- Story 6.6: SECURITY DEFINER functions for the occasion-reminder cron worker.
--
-- Why this exists:
--   provider.ts sets `app.current_shop_id = '00000000-...'` on every new pool
--   connection (the "poison UUID" — see packages/db/src/provider.ts). Combined with
--   FORCE ROW LEVEL SECURITY on customer_occasions, a raw SELECT from app_user
--   would silently return zero rows, even though the worker's intent is a
--   platform-wide cross-tenant scan.
--
-- These functions run as platform_admin (BYPASSRLS — see migration 0003) so they
-- can read/write across tenants. EXECUTE is granted to app_user; the function
-- bodies themselves are the authorization boundary.
--
-- Worker usage:
--   SELECT * FROM get_due_occasions(today_ist);
--   SELECT advance_occasion_to_next_year(occasion_id);

-- Read-side: returns occasions due today OR (today + reminder_days) across all tenants.
CREATE OR REPLACE FUNCTION get_due_occasions(check_date DATE)
RETURNS TABLE (
  id              UUID,
  shop_id         UUID,
  customer_id     UUID,
  occasion_type   TEXT,
  label           TEXT,
  month_day       TEXT,
  next_occurrence DATE,
  reminder_days   INTEGER
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    co.id, co.shop_id, co.customer_id, co.occasion_type, co.label,
    co.month_day, co.next_occurrence, co.reminder_days
  FROM customer_occasions co
  WHERE co.next_occurrence = check_date
     OR co.next_occurrence = (check_date + co.reminder_days * INTERVAL '1 day');
$$;

ALTER FUNCTION get_due_occasions(DATE) OWNER TO platform_admin;
REVOKE ALL ON FUNCTION get_due_occasions(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_due_occasions(DATE) TO app_user;

-- Write-side: advances a single occasion's next_occurrence to next year, with
-- the Feb-29 → Mar-1 fallback when the next year is non-leap.
CREATE OR REPLACE FUNCTION advance_occasion_to_next_year(occasion_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  cur_date  DATE;
  cur_year  INT;
  cur_month INT;
  cur_day   INT;
  new_year  INT;
  new_month INT;
  new_day   INT;
  is_leap   BOOLEAN;
BEGIN
  SELECT next_occurrence INTO cur_date FROM customer_occasions WHERE id = occasion_id;
  IF cur_date IS NULL THEN
    RETURN;
  END IF;

  cur_year  := EXTRACT(YEAR  FROM cur_date)::INT;
  cur_month := EXTRACT(MONTH FROM cur_date)::INT;
  cur_day   := EXTRACT(DAY   FROM cur_date)::INT;
  new_year  := cur_year + 1;
  new_month := cur_month;
  new_day   := cur_day;

  -- Leap-year guard: Feb 29 → Mar 1 if next year is non-leap.
  is_leap := (new_year % 4 = 0 AND new_year % 100 != 0) OR (new_year % 400 = 0);
  IF cur_month = 2 AND cur_day = 29 AND NOT is_leap THEN
    new_month := 3;
    new_day   := 1;
  END IF;

  UPDATE customer_occasions
     SET next_occurrence = MAKE_DATE(new_year, new_month, new_day)
   WHERE id = occasion_id;
END;
$$;

ALTER FUNCTION advance_occasion_to_next_year(UUID) OWNER TO platform_admin;
REVOKE ALL ON FUNCTION advance_occasion_to_next_year(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION advance_occasion_to_next_year(UUID) TO app_user;
