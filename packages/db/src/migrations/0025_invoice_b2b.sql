-- Story 5.8: B2B wholesale invoice — GSTIN, state codes, GST treatment columns
ALTER TABLE invoices
  ADD COLUMN buyer_gstin         TEXT,
  ADD COLUMN buyer_business_name TEXT,
  ADD COLUMN seller_state_code   TEXT NOT NULL DEFAULT '09',
  -- '09' = Uttar Pradesh (anchor shop state). Shopkeeper-configurable in Phase 2 via shop_settings.
  ADD COLUMN gst_treatment       TEXT NOT NULL DEFAULT 'CGST_SGST',
  -- 'CGST_SGST' | 'IGST'
  ADD COLUMN cgst_metal_paise    BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN sgst_metal_paise    BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN cgst_making_paise   BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN sgst_making_paise   BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN igst_metal_paise    BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN igst_making_paise   BIGINT NOT NULL DEFAULT 0;

-- Constrain invoice_type to known values
ALTER TABLE invoices
  ADD CONSTRAINT invoices_type_check
  CHECK (invoice_type IN ('B2C', 'B2B_WHOLESALE'));

-- B2B invoices must have a buyer GSTIN
ALTER TABLE invoices
  ADD CONSTRAINT invoices_b2b_requires_gstin
  CHECK (invoice_type = 'B2C' OR buyer_gstin IS NOT NULL);
