// DI tokens for the platform-admin module. Kept in a leaf file so services and the
// module itself can both import without forming a circular import (the module imports
// the services as providers; the services need to know the token at decoration time).
export const PG_POOL_ADMIN = 'PG_POOL_ADMIN';
