# Brand assets

Tenant-specific logos and splash artwork are NOT committed here. They load at runtime from
the per-tenant CDN URL returned by `GET /api/v1/tenant/boot?slug=<tenant>` in `branding.logoUrl`.

A future EAS build profile will inject a tenant-specific app icon + splash via the
`expo-build-properties` plugin and the `--config` flag at build time. Until then, dev
builds use the default Expo splash.
