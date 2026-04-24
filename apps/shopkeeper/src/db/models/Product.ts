import { Model } from '@nozbe/watermelondb';
import { field, date } from '@nozbe/watermelondb/decorators';

export class Product extends Model {
  static table = 'products';

  @field('server_id') serverId!: string | null;
  @field('sku') sku!: string;
  @field('metal') metal!: string;
  @field('purity') purity!: string;
  @field('gross_weight_g') grossWeightG!: string;
  @field('net_weight_g') netWeightG!: string;
  @field('stone_weight_g') stoneWeightG!: string;
  @field('huid') huid!: string | null;
  @field('status') status!: string;
  @date('published_at') publishedAt!: Date | null;
  @field('pending_sync') pendingSync!: boolean;
  @field('server_updated_at') serverUpdatedAt!: number | null;
}
