import { db } from '../db';
import { auditEvents } from '../schema';

// ruleid: no-drizzle-mutation-on-audit-events
db.update(auditEvents);

// ruleid: no-drizzle-mutation-on-audit-events
db.delete(auditEvents);
