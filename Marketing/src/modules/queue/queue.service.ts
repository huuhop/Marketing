import { InjectQueue } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bull';
import { ExportExcelJobDataDto } from 'src/modules/analytics/dto/export-excel-job-data-dto';
// import { AnalyticsService } from '../analytics/analytics.service';

type AddExportExcelJobToQueue = {
  jobName: string;
  data: ExportExcelJobDataDto;
};

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(process.env.EXCEL_QUEUE_EXPORT)
    private queue: Queue,
  ) {}

  async addExportExcelJobToQueue({ jobName, data }: AddExportExcelJobToQueue) {
    try {
      await this.queue.add(jobName, data, {
        delay: 2000,
        attempts: 10,
        backoff: 2000,
        removeOnComplete: true,
        removeOnFail: false,
      });
    } catch (e) {
      console.error('addExportExcelJobToQueue error', e);
    }
  }

  async addJob(data: any, processor: string): Promise<any> {
    try {
        await this.queue.add(processor, data, { delay: 2000, attempts: 10, backoff: 2000, removeOnComplete: true, removeOnFail: false});
        return;
    } catch (e) {
      console.log('addJob Err', e.message);
      throw new Error(e.message);
    }
  }
}
