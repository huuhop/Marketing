import { BullModule } from '@nestjs/bull';
import { Module, forwardRef } from '@nestjs/common';
import { ExcelProcessor } from './excel.processor';
import { AnalyticsModule } from '../analytics/analytics.mudule';

@Module(
  {
    imports: [
      forwardRef(() => AnalyticsModule),
      BullModule.forRoot({
        url: process.env.URL_CACHE
      }),
      BullModule.registerQueue({
        name: process.env.EXCEL_QUEUE_EXPORT,
      })
    ],
    providers: [
      ExcelProcessor,
    ]
  })
export class ProcessorModule {}
