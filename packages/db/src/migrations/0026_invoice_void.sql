-- Story 5.11: Invoice void (within 24h) + credit note (post-window)
ALTER TABLE invoices
  ADD COLUMN voided_at         TIMESTAMPTZ,
  ADD COLUMN voided_by_user_id UUID,
  ADD COLUMN void_reason       TEXT;

CREATE TABLE credit_notes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             UUID NOT NULL REFERENCES shops(id),
  original_invoice_id UUID NOT NULL REFERENCES invoices(id),
  credit_number       TEXT NOT NULL,
  reason              TEXT NOT NULL,
  total_paise         BIGINT NOT NULL,
  issued_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  issued_by_user_id   UUID NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_notes FORCE ROW LEVEL SECURITY;
CREATE POLICY credit_notes_tenant ON credit_notes
  USING      (shop_id = current_setting('app.current_shop_id', true)::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id', true)::uuid);

GRANT SELECT, INSERT ON credit_notes TO app_user;

CREATE UNIQUE INDEX idx_credit_notes_one_per_invoice
  ON credit_notes(shop_id, original_invoice_id);
