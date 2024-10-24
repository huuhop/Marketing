import { Module, forwardRef } from '@nestjs/common';
import { TasksService } from 'src/services/tasks.service';
import { ElasticModule } from '../elastic/elastic.module';
import { BullModule } from '@nestjs/bull';
import { AnalyticsModule } from '../analytics/analytics.mudule';

@Module({
  imports: [
    forwardRef(() => ElasticModule),
    forwardRef(() => AnalyticsModule),
    BullModule.forRoot({
      url: process.env.URL_CACHE
    }),
    BullModule.registerQueue({
      name: process.env.EXCEL_QUEUE_EXPORT,
    })
  ],
  providers: [
    TasksService,
  ],
})
export class CronsModule { }
