function SkipTenant() { return (_t: unknown, _k: string, _d: PropertyDescriptor) => _d; }
function SkipAuth() { return (_t: unknown, _k: string, _d: PropertyDescriptor) => _d; }

class SomeController {
  // ok: SkipTenant paired with SkipAuth
  @SkipAuth()
  @SkipTenant()
  healthCheck() { return 'ok'; }
}

void SomeController;
