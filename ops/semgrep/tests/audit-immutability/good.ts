import { db } from '../db';
import { auditEvents } from '../schema';

// ok: no-drizzle-mutation-on-audit-events
db.insert(auditEvents);

// ok: no-drizzle-mutation-on-audit-events
db.select().from(auditEvents);
