import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { createPool } from '@goldsmith/db';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { AuthRateLimitService } from './auth-rate-limit.service';
import { FirebaseAdminProvider } from './firebase-admin.provider';
import { FirebaseJwtStrategy } from './firebase-jwt.strategy';

@Module({
  imports: [PassportModule],
  controllers: [AuthController],
  providers: [
    {
      provide: 'PG_POOL',
      useFactory: () => createPool({ connectionString: process.env['DATABASE_URL'] ?? 'postgres://postgres:postgres@localhost:5432/goldsmith_dev' }),
    },
    FirebaseAdminProvider,
    FirebaseJwtStrategy,
    AuthService,
    AuthRepository,
    AuthRateLimitService,
  ],
  exports: [FirebaseAdminProvider, 'PG_POOL'],
})
export class AuthModule {}
