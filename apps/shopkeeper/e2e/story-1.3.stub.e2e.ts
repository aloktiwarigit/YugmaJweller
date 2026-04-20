// TODO: Detox — no device in CI. Implement when physical device/emulator is available in pipeline.
describe.skip('Story 1.3 — Staff Invite + RBAC', () => {
  it.todo('OWNER can invite staff via FAB on /settings/staff screen');
  it.todo('duplicate phone shows Hindi error: यह number पहले से staff में शामिल है।');
  it.todo('shop_staff cannot see Reports tab');
  it.todo('shop_manager can see Reports tab');
  it.todo('shop_admin can see Reports tab');
  it.todo('invited staff logs in and session returns role: shop_staff');
});
