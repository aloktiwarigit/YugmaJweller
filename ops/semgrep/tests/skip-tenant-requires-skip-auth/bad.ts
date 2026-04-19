function SkipTenant() { return (_t: unknown, _k: string, _d: PropertyDescriptor) => _d; }

class SomeController {
  // ruleid: goldsmith.skip-tenant-requires-skip-auth
  @SkipTenant()
  healthCheck() { return 'ok'; }
}

void SomeController;
