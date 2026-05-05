-- 0072_reports_pdf_exports.sql
-- Tracks asynchronous PDF export jobs (FR119). One row per requested PDF;
-- status transitions QUEUED → RUNNING → READY/FAILED via reports-pdf BullMQ
-- worker. Blob retention enforced via created_at + interval '7 days'
-- (cleanup is a separate ops follow-up, not in this story).
--
-- Spec correction: the plan's task C1 prescribed `REFERENCES users(id)`, but
-- the codebase has no `users` table — actors are `shop_users`. We use a
-- tenant-scoped composite FK (shop_id, requested_by_user_id) per the
-- 0058_product_images_tenant_fk.sql pattern, which closes the
-- FK-bypasses-RLS cross-tenant insert loophole called out in
-- feedback_spec_lessons_need_plan_assertions.md.

CREATE TABLE reports_pdf_exports (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id               UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
  report_type           TEXT NOT NULL CHECK (report_type IN
                          ('daily-summary','outstanding','customer-ltv',
                           'loyalty-summary','stock-aging')),
  params                JSONB NOT NULL DEFAULT '{}'::jsonb,
  status                TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN
                          ('QUEUED','RUNNING','READY','FAILED')),
  storage_key           TEXT,
  error_message         TEXT,
  requested_by_user_id  UUID NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at          TIMESTAMPTZ,
  CONSTRAINT reports_pdf_exports_shop_requester_fkey
    FOREIGN KEY (shop_id, requested_by_user_id)
    REFERENCES shop_users(shop_id, id)
    ON DELETE RESTRICT
);

CREATE INDEX reports_pdf_exports_shop_created_idx
  ON reports_pdf_exports (shop_id, created_at DESC);

ALTER TABLE reports_pdf_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports_pdf_exports FORCE ROW LEVEL SECURITY;

CREATE POLICY rls_reports_pdf_exports_tenant_isolation ON reports_pdf_exports
  FOR ALL
  USING      (shop_id = current_setting('app.current_shop_id')::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::uuid);

GRANT SELECT, INSERT, UPDATE ON reports_pdf_exports TO app_user;
