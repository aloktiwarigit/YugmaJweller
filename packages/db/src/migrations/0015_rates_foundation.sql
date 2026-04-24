-- ibja_rate_snapshots: platform-global gold/silver rate history (no RLS)
CREATE TABLE ibja_rate_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fetched_at timestamptz NOT NULL,
  source text NOT NULL,
  gold_24k_paise bigint NOT NULL,
  gold_22k_paise bigint NOT NULL,
  gold_20k_paise bigint NOT NULL,
  gold_18k_paise bigint NOT NULL,
  gold_14k_paise bigint NOT NULL,
  silver_999_paise bigint NOT NULL,
  silver_925_paise bigint NOT NULL,
  stale boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON ibja_rate_snapshots TO app_user;

CREATE INDEX idx_ibja_rate_snapshots_fetched_at
  ON ibja_rate_snapshots(fetched_at DESC);
