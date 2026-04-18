import { Injectable } from '@nestjs/common';
import type { TenantResolver, RequestLike } from '@goldsmith/tenant-context';

@Injectable()
export class HttpTenantResolver implements TenantResolver {
  async fromHost(_host: string): Promise<string | undefined> { return undefined; }
  fromHeader(req: RequestLike): string | undefined {
    const h = req.headers['x-tenant-id'];
    return typeof h === 'string' ? h : undefined;
  }
  fromJwt(_req: RequestLike): string | undefined { return undefined; }
}
