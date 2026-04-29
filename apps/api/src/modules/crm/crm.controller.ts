import { BadRequestException, Body, Controller, Delete, Get, NotImplementedException, Param, Patch, Post, Query, UnauthorizedException, ParseUUIDPipe } from '@nestjs/common';
import { z } from 'zod';
import { TenantContextDec } from '@goldsmith/tenant-context';
import type { TenantContext } from '@goldsmith/tenant-context';
import { CreateCustomerSchema, UpdateCustomerSchema, CustomerListQuerySchema, LinkFamilySchema, RequestDeletionDtoSchema } from '@goldsmith/shared';
import type { CreateCustomerDto, UpdateCustomerDto, CustomerResponse, LinkFamilyDto, FamilyMemberResponse, RequestDeletionDto, DeletionRequestResponse } from '@goldsmith/shared';
import type { CustomerSearchResult } from '@goldsmith/integrations-search';
import { Roles } from '../../common/decorators/roles.decorator';
import { SkipAuth } from '../../common/decorators/skip-auth.decorator';
import { SkipTenant } from '../../common/decorators/skip-tenant.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Inject } from '@nestjs/common';
import { CrmService } from './crm.service';
import { DpdpaDeletionService } from './dpdpa-deletion.service';
import { CrmSearchService } from './crm-search.service';
import { FamilyService } from './family.service';
import { HistoryService } from './history.service';
import type { PurchaseHistoryResponse } from './history.service';
import { BalanceService } from './balance.service';
import type { CustomerBalance } from './balance.service';
import { NotesService } from './notes.service';
import type { NoteResponse } from './notes.service';
import { OccasionsService } from './occasions.service';
import type { OccasionResponse, AddOccasionDto } from './occasions.service';

const AddNoteSchema = z.object({
  body: z.string().trim().min(1, 'Note body required').max(5000),
});

const AddOccasionSchema = z.object({
  occasionType: z.enum(['BIRTHDAY', 'ANNIVERSARY', 'FESTIVAL', 'OTHER']),
  label: z.string().trim().max(100).optional(),
  monthDay: z.string().regex(/^\d{2}-\d{2}$/, 'monthDay must be MM-DD'),
  reminderDays: z.number().int().min(1).max(365).optional(),
});

@Controller('/api/v1/crm')
export class CrmController {
  constructor(
    @Inject(CrmService)          private readonly svc: CrmService,
    @Inject(CrmSearchService)    private readonly searchSvc: CrmSearchService,
    @Inject(FamilyService)       private readonly familySvc: FamilyService,
    @Inject(HistoryService)      private readonly historySvc: HistoryService,
    @Inject(BalanceService)      private readonly balanceSvc: BalanceService,
    @Inject(NotesService)        private readonly notesSvc: NotesService,
    @Inject(OccasionsService)        private readonly occasionsSvc: OccasionsService,
    @Inject(DpdpaDeletionService)    private readonly dpdpaSvc: DpdpaDeletionService,
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

  // Must be registered before `customers/:id` to avoid "search" being parsed as a UUID
  @Get('customers/search') @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async searchCustomers(
    @TenantContextDec() ctx: TenantContext,
    @Query('q') q: string,
    @Query('city') city?: string,
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ): Promise<CustomerSearchResult> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.searchSvc.searchCustomers(ctx, {
      q: q ?? '',
      city,
      limit:  Math.max(1, Math.min(parseInt(limitStr ?? '20', 10) || 20, 100)),
      offset: Math.max(0, parseInt(offsetStr ?? '0', 10) || 0),
    });
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
  async addNote(@TenantContextDec() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(AddNoteSchema)) body: { body: string }): Promise<NoteResponse> {
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
  async addOccasion(@TenantContextDec() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(AddOccasionSchema)) dto: AddOccasionDto): Promise<OccasionResponse> {
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

  @Get('customers/:id/history') @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async getPurchaseHistory(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<PurchaseHistoryResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.historySvc.getPurchaseHistory(ctx, id, {
      limit:  Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20)),
      offset: Math.max(0, parseInt(offset ?? '0', 10) || 0),
    });
  }

  @Get('customers/:id/balance') @Roles('shop_admin', 'shop_manager', 'shop_staff')
  async getBalance(@TenantContextDec() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string): Promise<CustomerBalance> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.balanceSvc.getBalance(ctx, id);
  }

  @Post('customers/:id/request-deletion') @Roles('shop_admin')
  async requestDeletion(
    @TenantContextDec() ctx: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(RequestDeletionDtoSchema)) dto: RequestDeletionDto,
  ): Promise<DeletionRequestResponse> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    // Use getCustomerIncludingDeleted so that a retry on an already-requested
    // customer still reaches softDeleteAtomic (which returns already_requested),
    // rather than failing with a misleading 404 from the standard read path.
    const customer = await this.dpdpaSvc.getCustomerIncludingDeleted(ctx, id);
    if (customer.name.trim() !== dto.confirmationName.trim()) {
      throw new BadRequestException({ code: 'crm.deletion.confirmation_mismatch', message: 'Confirmation name does not match the customer record' });
    }
    return this.dpdpaSvc.requestDeletion(ctx, id, dto.requestedBy);
  }

  @Post('customers/:id/restore-deletion') @Roles('shop_admin')
  async restoreDeletion(@TenantContextDec() ctx: TenantContext, @Param('id', ParseUUIDPipe) id: string): Promise<never> {
    if (!ctx.authenticated) throw new UnauthorizedException({ code: 'auth.not_authenticated' });
    return this.dpdpaSvc.restoreDeletion(ctx, id);
  }

  @Delete('customer/me') @SkipAuth() @SkipTenant()
  customerSelfDelete(): never {
    throw new NotImplementedException({ code: 'deletion.customer_app_not_yet_available', message: 'Self-deletion via the customer app launches in Epic 7.' });
  }
}