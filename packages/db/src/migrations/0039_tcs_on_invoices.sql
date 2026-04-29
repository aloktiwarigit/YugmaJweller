-- 0039_tcs_on_invoices.sql
-- Section 206C(1D) Income Tax Act: sellers must collect 1% TCS on jewellery invoices
-- exceeding Rs 2,00,000. Adds tcs_collected_paise column to invoices.
--
-- BIGINT (paise, integer-exact). DEFAULT 0 so existing rows are valid (pre-law invoices).
-- NOT NULL so every future invoice carries an explicit TCS figure.

BEGIN;

ALTER TABLE invoices
  ADD COLUMN tcs_collected_paise BIGINT NOT NULL DEFAULT 0
    CONSTRAINT invoices_tcs_collected_paise_check CHECK (tcs_collected_paise >= 0);

COMMIT;
