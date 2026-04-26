import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UnauthorizedException, ParseUUIDPipe } from '@nestjs/common';
import { TenantContextDec } from '@goldsmith/tenant-context';
import type { TenantContext } from '@goldsmith/tenant-context';
import { CreateCustomerSchema, UpdateCustomerSchema, CustomerListQuerySchema, LinkFamilySchema } from '@goldsmith/shared';
import type { CreateCustomerDto, UpdateCustomerDto, CustomerResponse, LinkFamilyDto, FamilyMemberResponse } from '@goldsmith/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CrmService } from './crm.service';
import { FamilyService } from './family.service';
import { NotesService } from './notes.service';
import type { NoteResponse } from './notes.service';
import { OccasionsService } from './occasions.service';
import type { OccasionResponse, AddOccasionDto } from './occasions.service';

@Controller('/api/v1/crm')
export class CrmController {
  constructor(
    private readonly svc: CrmService,
    private readonly familySvc: FamilyService,
    private readonly notesSvc: NotesService,
    private readonly occasionsSvc: OccasionsService,
  ) {}

  @Post('customers') @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async createCustomer(@TenantContextDec() ctx: TenantContext, @Body(new ZodValidationPipe(CreateCustomerSchema)) dto: CreateCustomerDto): Promise<CustomerResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.createCustomer(ctx, dto);
  }

  @Get('customers') @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async listCustomers(@TenantContextDec() ctx: TenantContext, @Query(new ZodValidationPipe(CustomerListQuerySchema)) query: { q?: string; limit: number; offset: number }): Promise<{ customers: CustomerResponse[]; total: number }> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.listCustomers(ctx, query.q, query.limit ?? 20, query.offset ?? 0);
  }

  @Get('customers/:id') @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async getCustomer(@TenantContextDec() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string): Promise<CustomerResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.getCustomer(ctx, id);
  }

  @Patch('customers/:id') @Roles('shop_admin', 'shop_manager')
  async updateCustomer(@TenantContextDec() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(UpdateCustomerSchema)) dto: UpdateCustomerDto): Promise<CustomerResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.svc.updateCustomer(ctx, id, dto);
  }
  @Post('customers/:id/family') @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async linkFamily(@TenantContextDec() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(LinkFamilySchema)) dto: LinkFamilyDto): Promise<FamilyMemberResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.familySvc.linkFamily(ctx, { customerId: id, ...dto });
  }

  @Delete('customers/:id/family/:linkId') @Roles('shop_admin', 'shop_manager')
  async unlinkFamily(@TenantContextDec() ctx: TenantContext, @Param('id', ParseUUIDPipe) customerId: string, @Param('linkId', ParseUUIDPipe) linkId: string): Promise<void> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.familySvc.unlinkFamily(ctx, customerId, linkId);
  }

  @Get('customers/:id/family') @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async getFamilyLinks(@TenantContextDec() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string): Promise<FamilyMemberResponse[]> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.familySvc.getFamilyLinks(ctx, id);
  }

  @Post('customers/:id/notes') @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async addNote(@TenantContextDec() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body() body: { body: string }): Promise<NoteResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.notesSvc.addNote(ctx, id, body.body);
  }

  @Get('customers/:id/notes') @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async listNotes(@TenantContextDec() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string): Promise<NoteResponse[]> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.notesSvc.listNotes(ctx, id);
  }

  @Delete('customers/:id/notes/:noteId') @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async deleteNote(@TenantContextDec() ctx: TenantContext, @Param('id', ParseUUIDPipe) _id: string, @Param('noteId', ParseUUIDPipe) noteId: string): Promise<void> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.notesSvc.deleteNote(ctx, noteId, ctx.userId, ctx.role);
  }

  @Post('customers/:id/occasions') @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async addOccasion(@TenantContextDec() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AddOccasionDto): Promise<OccasionResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.occasionsSvc.addOccasion(ctx, id, dto);
  }

  @Get('customers/:id/occasions') @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async listOccasions(@TenantContextDec() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string): Promise<OccasionResponse[]> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.occasionsSvc.listOccasions(ctx, id);
  }

  @Delete('customers/:id/occasions/:occId') @Roles('shop_admin', 'shop_manager')
  async deleteOccasion(@TenantContextDec() ctx: TenantContext, @Param('id', ParseUUIDPipe) _id: string, @Param('occId', ParseUUIDPipe) occId: string): Promise<void> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.occasionsSvc.deleteOccasion(ctx, occId);
  }
}