import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, type TestingModule } from '@nestjs/testing';
import { CustomerSessionController } from '../customer-session.controller';
import { CustomerSessionService } from '../customer-session.service';
import { FirebaseAdminProvider } from '../../auth/firebase-admin.provider';
import { UnauthorizedException } from '@nestjs/common';

const mockVerifyIdToken = vi.fn();
const mockFirebase = { admin: () => ({ auth: () => ({ verifyIdToken: mockVerifyIdToken }) }) };
const mockPool = { query: vi.fn().mockResolvedValue({ rows: [] }) };
const mockService = { findOrCreateCustomerByFirebaseToken: vi.fn() };

describe('CustomerSessionController', () => {
  let controller: CustomerSessionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CustomerSessionController],
      providers: [
        { provide: FirebaseAdminProvider, useValue: mockFirebase },
        { provide: 'PG_POOL', useValue: mockPool },
        { provide: CustomerSessionService, useValue: mockService },
      ],
    }).compile();
    controller = module.get(CustomerSessionController);
    vi.clearAllMocks();
    mockPool.query.mockResolvedValue({ rows: [] });
  });

  it('returns customer session when token is valid', async () => {
    mockVerifyIdToken.mockResolvedValue({ uid: 'firebase-uid', phone_number: '+919999999999' });
    mockService.findOrCreateCustomerByFirebaseToken.mockResolvedValue({
      customerId: 'db-uuid-1', name: 'Test', phoneE164: '+919999999999',
      email: null, authProvider: 'phone', isNewUser: false,
    });
    const req = {
      headers: {
        authorization: 'Bearer valid-token',
        'x-tenant-id': '11111111-1111-4111-8111-111111111111',
      },
    };
    const result = await controller.createSession(req as never);
    expect(result.customer.id).toBe('db-uuid-1');
    expect(result.isNewUser).toBe(false);
  });

  it('throws 401 when authorization header is missing', async () => {
    const req = { headers: { 'x-tenant-id': '11111111-1111-4111-8111-111111111111' } };
    await expect(controller.createSession(req as never)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws 401 when x-tenant-id header is missing', async () => {
    const req = { headers: { authorization: 'Bearer valid-token' } };
    await expect(controller.createSession(req as never)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws 401 when verifyIdToken rejects', async () => {
    mockVerifyIdToken.mockRejectedValue(new Error('Token expired'));
    const req = {
      headers: {
        authorization: 'Bearer bad-token',
        'x-tenant-id': '11111111-1111-4111-8111-111111111111',
      },
    };
    await expect(controller.createSession(req as never)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
