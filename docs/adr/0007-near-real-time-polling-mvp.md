# 0007 — Near-Real-Time Sync: TanStack Query Polling for MVP

**Status:** Accepted
**Date:** 2026-04-17
**Deciders:** Winston (Architect), John (PM)

## Context

PRD FR30 + NFR-P6 require **shopkeeper writes to propagate to the customer app within 30 seconds at p95** for MVP. The UX spec makes this a product commitment ("shopkeeper changes making charge at 10pm → customer app reflects in 30 seconds").

Three technical approaches were considered:
1. **Polling** (TanStack Query `refetchInterval`).
2. **Long-poll** (HTTP hang up to 25s awaiting change).
3. **WebSocket or SSE** (push-based).

## Decision

Adopt **polling via TanStack Query** for MVP. Defer WebSocket/SSE to Phase 3+.

**Polling cadence by data class:**
- **Hot** (product availability, gold rate, new inquiries on shopkeeper): 5 seconds.
- **Medium-hot** (wishlist, custom order status, rate-lock countdown): 30 seconds.
- **Cold** (catalog category counts, review counts, loyalty tier progression): 60 seconds.

**Server contract:**
- `Last-Modified` and `ETag` headers on every cacheable read endpoint.
- Clients send `If-None-Match` → 304 avoids payload transfer.
- Cache-Control: per-endpoint (`public, max-age=5, s-maxage=5, stale-while-revalidate=30` for hot; longer for cold).

**Optimistic updates:**
- Client mutations use TanStack Query `onMutate` to optimistically patch cache, then revalidate on mutation result.
- Rollback on error.

**Degraded-mode fallback:**
- If server reports latency > threshold, clients back off to 60s across all queries (feature flag controlled).

## Consequences

**Positive:**
- Simple to implement; no WebSocket infrastructure (no sticky sessions, no load-balancer gotchas, no reconnection logic).
- Fits NFR-P6 envelope (30s p95 is comfortably within polling bounds).
- Works trivially offline-then-online.
- CDN + HTTP caching reduce load for popular reads.

**Negative / trade-offs:**
- Unnecessary requests when nothing changed — mitigated by 304 + CDN cache.
- Not suitable for sub-second updates (billing screen's "stock just sold elsewhere" could be 5-second-stale — acceptable per PRD).
- Mobile battery impact if too aggressive — 5s interval only on active foreground screens; apps pause polling when backgrounded.

## Alternatives Considered

| Option | Rejected because |
|--------|------------------|
| **WebSocket (e.g., Socket.io)** | Sticky sessions + load balancer complexity; reconnection logic; connection limit scaling; operational burden for 0.5-FTE DevOps; not needed for 30s SLA |
| **Server-Sent Events (SSE)** | Simpler than WebSocket but still requires long-lived connections at scale; reverse-proxy + CDN behaviour quirky; deferred |
| **Long-poll** | Intermediate complexity; holds connections; still needs connection-limit tuning; evaluated as Phase 2 upgrade for specific paths |
| **Supabase Realtime** | Vendor lock-in for real-time layer; our DB is Postgres which Supabase Realtime can listen to, but adds dependency + Supabase infra footprint |
| **GraphQL Subscriptions** | Requires GraphQL which we aren't adopting |

## Implementation Notes

### TanStack Query setup

```ts
// apps/customer/src/providers/query-client.ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      refetchOnWindowFocus: true,
      refetchInterval: 30000,       // medium-hot default
      retry: 2,
    },
  },
});

// Per-query override
export function useProductDetail(productId: string) {
  return useQuery({
    queryKey: ['product', productId],
    queryFn: () => api.getProduct(productId),
    refetchInterval: 5000,        // hot
  });
}
```

### Server caching

```ts
@Get(':id')
@Header('Cache-Control', 'public, max-age=5, s-maxage=5, stale-while-revalidate=30')
async getProduct(@Param('id') id: string, @Req() req, @Res({ passthrough: true }) res) {
  const product = await this.catalog.getProduct(/* ctx */, id);
  const etag = `W/"${product.version}"`;
  if (req.headers['if-none-match'] === etag) {
    res.status(304);
    return;
  }
  res.setHeader('ETag', etag);
  return product;
}
```

## Revisit triggers

- Polling cost (server req/sec) becomes material — profile top endpoints, add long-poll or WebSocket for top 3 hot paths.
- Business requirement emerges for sub-second UX (e.g., custom order "live video call" feature) — deploy WebSocket for that feature only.
- Tenant count exceeds 100 and polling dominates API load → invest in push-based.

## References

- PRD FR30, NFR-P6
- Architecture §Core Decisions A7
- UX spec §Real-time sync contract
