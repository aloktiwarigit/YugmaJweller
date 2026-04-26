-- Story 6.9: Viewing consent schema (DPDPA-compliant foundation for Epic 12 viewing analytics)
-- One row per customer per shop. Records explicit consent grant/withdrawal with version,
-- IP, user-agent, and timestamps. customers.viewing_consent boolean (from 0028) remains
-- as a legacy stub — superseded by this table; future story may drop it.
CREATE TABLE viewing_consent (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id               UUID NOT NULL REFERENCES shops(id),
  customer_id           UUID NOT NULL REFERENCES customers(id),
  consent_given         BOOLEAN NOT NULL DEFAULT false,
  consent_version       TEXT NOT NULL DEFAULT 'v1',
  consented_at          TIMESTAMPTZ,
  withdrawn_at          TIMESTAMPTZ,
  ip_at_consent         TEXT,
  user_agent_at_consent TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT viewing_consent_unique_customer UNIQUE (shop_id, customer_id)
);

ALTER TABLE viewing_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE viewing_consent FORCE ROW LEVEL SECURITY;

CREATE POLICY viewing_consent_tenant ON viewing_consent
  USING      (shop_id = current_setting('app.current_shop_id')::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::uuid);

GRANT SELECT, INSERT, UPDATE ON viewing_consent TO app_user;

CREATE INDEX idx_viewing_consent_customer ON viewing_consent(shop_id, customer_id);
