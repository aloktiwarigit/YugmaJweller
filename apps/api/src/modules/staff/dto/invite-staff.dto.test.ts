import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { InviteStaffDto } from './invite-staff.dto';

describe('InviteStaffDto', () => {
  it('accepts valid shop_staff body', async () => {
    const dto = plainToInstance(InviteStaffDto, { phone: '+919876543210', display_name: 'Amit', role: 'shop_staff' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts valid shop_manager body', async () => {
    const dto = plainToInstance(InviteStaffDto, { phone: '+919876543210', display_name: 'Priya', role: 'shop_manager' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects shop_admin role', async () => {
    const dto = plainToInstance(InviteStaffDto, { phone: '+919876543210', display_name: 'X', role: 'shop_admin' });
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'role')).toBe(true);
  });

  it('rejects non-+91 phone', async () => {
    const dto = plainToInstance(InviteStaffDto, { phone: '+14155551234', display_name: 'X', role: 'shop_staff' });
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'phone')).toBe(true);
  });

  it('rejects phone shorter than 13 chars', async () => {
    const dto = plainToInstance(InviteStaffDto, { phone: '+9198765', display_name: 'X', role: 'shop_staff' });
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'phone')).toBe(true);
  });

  it('rejects empty display_name', async () => {
    const dto = plainToInstance(InviteStaffDto, { phone: '+919876543210', display_name: '', role: 'shop_staff' });
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'display_name')).toBe(true);
  });

  it('rejects display_name longer than 100 chars', async () => {
    const dto = plainToInstance(InviteStaffDto, { phone: '+919876543210', display_name: 'A'.repeat(101), role: 'shop_staff' });
    const errors = await validate(dto);
    expect(errors.some(e => e.property === 'display_name')).toBe(true);
  });
});
