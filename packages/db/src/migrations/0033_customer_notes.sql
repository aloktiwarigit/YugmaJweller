-- Story 6.5: Customer Notes (soft-delete)
CREATE TABLE customer_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID NOT NULL REFERENCES shops(id),
  customer_id     UUID NOT NULL REFERENCES customers(id),
  body            TEXT NOT NULL,
  author_user_id  UUID NOT NULL,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_notes FORCE ROW LEVEL SECURITY;
CREATE POLICY customer_notes_tenant ON customer_notes
  USING (shop_id = current_setting('app.current_shop_id')::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::uuid);
GRANT SELECT, INSERT, UPDATE ON customer_notes TO app_user;

CREATE INDEX idx_customer_notes_customer
  ON customer_notes(shop_id, customer_id, created_at DESC)
  WHERE deleted_at IS NULL;
