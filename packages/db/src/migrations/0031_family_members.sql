-- Story 6.2: Customer Family Links
-- Bidirectional family graph stored as directed edges (A→B and B→A both rows).
-- self-link prevented by CHECK constraint; unique index prevents duplicate edges.
CREATE TABLE family_members (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             UUID NOT NULL REFERENCES shops(id),
  customer_id         UUID NOT NULL REFERENCES customers(id),
  related_customer_id UUID NOT NULL REFERENCES customers(id),
  relationship        TEXT NOT NULL CHECK (relationship IN (
                        'SPOUSE','PARENT','CHILD','SIBLING','IN_LAW','OTHER'
                      )),
  created_by_user_id  UUID NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_self_link CHECK (customer_id != related_customer_id)
);

ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members FORCE ROW LEVEL SECURITY;

CREATE POLICY family_members_tenant ON family_members
  USING (shop_id = current_setting('app.current_shop_id')::uuid)
  WITH CHECK (shop_id = current_setting('app.current_shop_id')::uuid);

GRANT SELECT, INSERT, DELETE ON family_members TO app_user;

CREATE UNIQUE INDEX idx_family_members_unique_edge
  ON family_members(shop_id, customer_id, related_customer_id);
