-- Story 6.6: Customer Occasions + reminder scheduling
CREATE TABLE customer_occasions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID NOT NULL REFERENCES shops(id),
  customer_id     UUID NOT NULL REFERENCES customers(id),
  occasion_type   TEXT NOT NULL CHECK (occasion_type IN
                    ('BIRTHDAY','ANNIVERSARY','FESTIVAL','OTHER')),
  label           TEXT,
  month_day       TEXT NOT NULL CHECK (month_day ~ '^\d{2}-\d{2}$'),
  next_occurrence DATE,
  reminder_days   INTEGER NOT NULL DEFAULT 7,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE customer_occasions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_occasions FORCE ROW LEVEL SECURITY;
CREATE POLICY customer_occasions_tenant ON customer_occasions
  USING (shop_id = current_setting('app.current_shop_id')::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON customer_occasions TO app_user;
