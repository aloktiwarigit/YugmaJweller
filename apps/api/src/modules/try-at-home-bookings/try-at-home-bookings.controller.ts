import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { TryAtHomeBookingsService } from './try-at-home-bookings.service';
import type { BookingResponse } from './try-at-home-bookings.service';

const CreateBookingSchema = z.object({
  customerId:  z.string().uuid(),
  productIds:  z.array(z.string().uuid()).min(1).max(20),
  notes:       z.string().max(500).optional(),
});

const RecordReturnSchema = z.object({
  returnedProductIds: z.array(z.string().uuid()),
  keptProductIds:     z.array(z.string().uuid()),
  keptCustomerName:   z.string().min(1).max(200).optional(),
  keptCustomerPhone:  z.string().regex(/^[6-9]\d{9}$/).optional(),
});

@Controller('/api/v1/try-at-home/bookings')
export class TryAtHomeBookingsController {
  constructor(
    @Inject(TryAtHomeBookingsService) private readonly svc: TryAtHomeBookingsService,
  ) {}

  @Post()
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  @UsePipes(new ZodValidationPipe(CreateBookingSchema))
  createBooking(@Body() body: z.infer<typeof CreateBookingSchema>): Promise<BookingResponse> {
    return this.svc.createBooking(body);
  }

  @Get()
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  list(
    @Query('limit',  new ParseIntPipe({ optional: true })) limit  = 20,
    @Query('offset', new ParseIntPipe({ optional: true })) offset = 0,
  ): Promise<{ bookings: BookingResponse[]; total: number }> {
    return this.svc.list({ limit, offset });
  }

  @Get(':id')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  getById(@Param('id', ParseUUIDPipe) id: string): Promise<BookingResponse> {
    return this.svc.getById(id);
  }

  @Patch(':id/dispatch')
  @Roles('shop_admin', 'shop_manager')
  dispatch(@Param('id', ParseUUIDPipe) id: string): Promise<BookingResponse> {
    return this.svc.dispatchBooking(id);
  }

  @Post(':id/record-return')
  @Roles('shop_admin', 'shop_manager', 'shop_staff')
  @UsePipes(new ZodValidationPipe(RecordReturnSchema))
  recordReturn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: z.infer<typeof RecordReturnSchema>,
  ): Promise<BookingResponse & { invoiceId?: string }> {
    return this.svc.recordReturn(id, body);
  }
}
