import { BullModule } from '@nestjs/bull';
import { Module, forwardRef } from '@nestjs/common';
import { QueueService } from './queue.service';
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
      QueueService
    ],  
    exports: [QueueService]
  })
export class QueueModule {}
