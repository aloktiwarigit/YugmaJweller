-- Review upsert uses ON CONFLICT DO UPDATE, so app_user needs UPDATE in addition
-- to SELECT/INSERT on product_reviews. Kept as a follow-up migration so applied
-- environments do not rely on editing historical 0047.
GRANT UPDATE ON product_reviews TO app_user;
