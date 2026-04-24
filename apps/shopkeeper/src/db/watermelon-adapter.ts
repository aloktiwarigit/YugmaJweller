import type { Database } from '@nozbe/watermelondb';
import type { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import type { PullResponse, PushResponse, TableChanges } from '@goldsmith/sync';
import type { Product } from './models/Product';

type PullWire = Omit<PullResponse, 'cursor'> & { cursor: string };
type PushWire = Omit<PushResponse, 'cursor'> & { cursor: string };

async function collectPendingChanges(database: Database): Promise<Partial<Record<string, TableChanges>>> {
  const all = await database.get<Product>('products').query().fetch();
  const pending = all.filter((p) => p.pendingSync && !p.serverId);

  if (pending.length === 0) return {};

  return {
    products: {
      created: pending.map((p) => ({
        id: p.id,
        sku: p.sku,
        metal: p.metal,
        purity: p.purity,
        gross_weight_g: p.grossWeightG,
        net_weight_g: p.netWeightG,
        stone_weight_g: p.stoneWeightG,
        huid: p.huid,
        status: p.status,
        updated_at: new Date().toISOString(),
      })),
      updated: [],
      deleted: [],
    },
  };
}

async function applyPulledChanges(database: Database, changes: PullResponse['changes']): Promise<void> {
  const productChanges = changes['products'];
  if (!productChanges) return;

  await database.write(async () => {
    const col = database.get<Product>('products');
    const allLocal = await col.query().fetch();

    for (const raw of productChanges.created) {
      const r = raw as Record<string, unknown>;
      await col.create((p) => {
        p.serverId = String(r['id']);
        p.sku = String(r['sku'] ?? '');
        p.metal = String(r['metal'] ?? '');
        p.purity = String(r['purity'] ?? '');
        p.grossWeightG = String(r['gross_weight_g'] ?? '0.000');
        p.netWeightG = String(r['net_weight_g'] ?? '0.000');
        p.stoneWeightG = String(r['stone_weight_g'] ?? '0.000');
        p.huid = r['huid'] ? String(r['huid']) : null;
        p.status = String(r['status'] ?? 'IN_STOCK');
        p.pendingSync = false;
        p.serverUpdatedAt = r['updated_at'] ? new Date(String(r['updated_at'])).getTime() : null;
      });
    }

    for (const raw of productChanges.updated) {
      const r = raw as Record<string, unknown>;
      const local = allLocal.find((p) => p.serverId === String(r['id']));
      if (!local) continue;
      await local.update((p) => {
        p.status = String(r['status'] ?? p.status);
        if (r['huid'] !== undefined) p.huid = r['huid'] ? String(r['huid']) : null;
        p.pendingSync = false;
        p.serverUpdatedAt = r['updated_at'] ? new Date(String(r['updated_at'])).getTime() : p.serverUpdatedAt;
      });
    }

    for (const { id } of productChanges.deleted) {
      const local = allLocal.find((p) => p.serverId === id);
      if (local) await local.markAsDeleted();
    }
  });
}

export async function syncWithServer(
  database: Database,
  apiClient: AxiosInstance,
  lastCursor: bigint,
): Promise<{ cursor: bigint; conflicts: PushResponse['conflicts'] }> {
  const pendingChanges = await collectPendingChanges(database);

  const pullResp = await apiClient.get<PullWire>('/api/v1/sync/pull', {
    params: { lastCursor: lastCursor.toString(), tables: 'products' },
  });
  await applyPulledChanges(database, pullResp.data.changes as PullResponse['changes']);

  const hasPending = Object.values(pendingChanges).some(
    (c) => c && (c.created.length > 0 || c.updated.length > 0 || c.deleted.length > 0),
  );

  if (hasPending) {
    const pushResp = await apiClient.post<PushWire>('/api/v1/sync/push', {
      changes: pendingChanges,
      idempotencyKey: uuidv4(),
    });
    return {
      cursor: BigInt(pushResp.data.cursor),
      conflicts: pushResp.data.conflicts,
    };
  }

  return { cursor: BigInt(pullResp.data.cursor), conflicts: [] };
}
