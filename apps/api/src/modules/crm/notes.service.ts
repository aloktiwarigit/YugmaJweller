import { Injectable, Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { withTenantTx } from '@goldsmith/db';
import { auditLog, AuditAction } from '@goldsmith/audit';
import type { AuthenticatedTenantContext } from '@goldsmith/tenant-context';

export interface NoteRow {
  id: string;
  shop_id: string;
  customer_id: string;
  body: string;
  author_user_id: string;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface NoteResponse {
  id: string;
  customerId: string;
  body: string;
  authorUserId: string;
  createdAt: string;
  updatedAt: string;
}

function rowToResponse(row: NoteRow): NoteResponse {
  return {
    id: row.id,
    customerId: row.customer_id,
    body: row.body,
    authorUserId: row.author_user_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

@Injectable()
export class NotesService {
  constructor(@Inject('PG_POOL') private readonly pool: Pool) {}

  async addNote(ctx: AuthenticatedTenantContext, customerId: string, body: string): Promise<NoteResponse> {
    const note = await withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<NoteRow>(
        `INSERT INTO customer_notes (shop_id, customer_id, body, author_user_id)
         VALUES (current_setting('app.current_shop_id')::uuid, $1, $2, $3)
         RETURNING *`,
        [customerId, body, ctx.userId],
      );
      return r.rows[0];
    });

    void auditLog(this.pool, {
      action: AuditAction.CRM_NOTE_ADDED,
      subjectType: 'customer_note',
      subjectId: note.id,
      actorUserId: ctx.userId,
      after: { customerId, noteId: note.id },
    }).catch(() => undefined);

    return rowToResponse(note);
  }

  async listNotes(_ctx: AuthenticatedTenantContext, customerId: string): Promise<NoteResponse[]> {
    const rows = await withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<NoteRow>(
        `SELECT * FROM customer_notes
         WHERE customer_id = $1 AND deleted_at IS NULL
         ORDER BY created_at DESC`,
        [customerId],
      );
      return r.rows;
    });
    return rows.map(rowToResponse);
  }

  async deleteNote(
    _ctx: AuthenticatedTenantContext,
    noteId: string,
    requestingUserId: string,
    requestingRole: string,
  ): Promise<void> {
    await withTenantTx(this.pool, async (tx) => {
      const r = await tx.query<NoteRow>(
        `SELECT * FROM customer_notes WHERE id = $1 AND deleted_at IS NULL`,
        [noteId],
      );
      const note = r.rows[0];
      if (!note) throw new NotFoundException({ code: 'crm.note_not_found' });
      if (note.author_user_id !== requestingUserId && requestingRole !== 'shop_admin') {
        throw new ForbiddenException({ code: 'crm.note_delete_forbidden', message: 'केवल लेखक/owner हटा सकते' });
      }
      await tx.query(
        `UPDATE customer_notes SET deleted_at = now(), updated_at = now() WHERE id = $1`,
        [noteId],
      );
    });
  }
}
