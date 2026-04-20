import { Module, OnModuleDestroy, Inject } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { Redis } from '@goldsmith/cache';
import { createPool } from '@goldsmith/db';
import { PermissionsCache } from '@goldsmith/tenant-config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { PermissionsRepository } from './permissions.repository';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { FirebaseAdminProvider } from './firebase-admin.provider';
import { FirebaseJwtStrategy } from './firebase-jwt.strategy';
import { MockSmsAdapter } from './sms/mock-sms.adapter';
import { SMS_ADAPTER } from './sms/sms-adapter.interface';
import { PolicyGuard } from './guards/policy.guard';

@Module({
  imports: [PassportModule],
  controllers: [AuthController],
  providers: [
    {
      provide: 'PG_POOL',
      useFactory: () => createPool({ connectionString: process.env['DATABASE_URL'] ?? 'postgres://postgres:postgres@localhost:5432/goldsmith_dev' }),
    },
    {
      provide: 'AUTH_REDIS',
      useFactory: () => new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379'),
    },
    {
      provide: PermissionsCache,
      useFactory: (redis: Redis) => new PermissionsCache(redis),
      inject: ['AUTH_REDIS'],
    },
    {
      provide: PolicyGuard,
      useFactory: (reflector: Reflector, cache: PermissionsCache, repo: PermissionsRepository) =>
        new PolicyGuard(reflector, cache, repo),
      inject: [Reflector, PermissionsCache, PermissionsRepository],
    },
    FirebaseAdminProvider,
    FirebaseJwtStrategy,
    AuthService,
    AuthRepository,
    PermissionsRepository,
    AuthRateLimitService,
    { provide: SMS_ADAPTER, useClass: MockSmsAdapter },
  ],
  exports: [FirebaseAdminProvider, 'PG_POOL', PermissionsCache, PermissionsRepository, PolicyGuard],
})
export class AuthModule implements OnModuleDestroy {
  constructor(@Inject('AUTH_REDIS') private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
