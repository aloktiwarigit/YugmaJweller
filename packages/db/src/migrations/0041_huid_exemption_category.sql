-- Migration 0041: HUID exemption categories for BIS-exempt product types
-- Kundan/Polki/Jadau cannot be hallmarked by nature; sub-2g items are BIS-exempt.
-- Default 'none' preserves backward compatibility — existing products still require HUID if hallmarked.

CREATE TYPE huid_exemption_category AS ENUM ('none', 'kundan_polki_jadau', 'under_2g');

ALTER TABLE products
  ADD COLUMN huid_exemption_category huid_exemption_category NOT NULL DEFAULT 'none';
