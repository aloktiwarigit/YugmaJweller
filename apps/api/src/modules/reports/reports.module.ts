import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { StorageModule } from '@goldsmith/integrations-storage';
import { AuthModule } from '../auth/auth.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsExportService } from './reports-export.service';
import { BrandingLoader } from './pdf/branding';
import { PdfRenderer } from './pdf/renderer';
import { ReportsPdfProcessor } from '../../workers/reports-pdf.processor';

@Module({
  imports: [
    AuthModule,
    StorageModule,
    BullModule.registerQueue({ name: 'reports-pdf' }),
  ],
  controllers: [ReportsController],
  providers: [
    ReportsService,
    ReportsExportService,
    BrandingLoader,
    PdfRenderer,
    ReportsPdfProcessor,
  ],
  exports: [ReportsService],
})
export class ReportsModule {}
