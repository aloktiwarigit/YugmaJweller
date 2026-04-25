-- Story 5.3: PAN Rule 114B — encrypted PAN storage on invoices
-- Both columns nullable: only populated when invoice total >= Rs 2,00,000
ALTER TABLE invoices
  ADD COLUMN pan_ciphertext   BYTEA,
  ADD COLUMN pan_key_id       TEXT,
  ADD COLUMN form60_encrypted BYTEA,
  ADD COLUMN form60_key_id    TEXT;

-- pan_key_id references the KEK ARN used for this invoice (from shops.kek_key_arn at time of write)
-- Retained for key-rotation audit trail even after decryption
