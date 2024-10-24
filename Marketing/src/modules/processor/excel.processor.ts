import { Process, Processor } from '@nestjs/bull';
import { Inject, forwardRef } from '@nestjs/common';
import { Job } from 'bull';
import { JobName, pageFileName } from 'src/common/commom';
import { AnalyticsService } from 'src/modules/analytics/analytics.service';

@Processor(process.env.EXCEL_QUEUE_EXPORT)
export class ExcelProcessor {
  constructor(
    @Inject(forwardRef(() => AnalyticsService))
    private analyticsService: AnalyticsService,
  ) {}
  @Process(`${process.env.EXCEL_MASTER_QUEUE_PROCESSOR}`)
  async handleMyJob(job: Job<any>): Promise<any> {
    try {
      // Xử lý công việc ở đây
      await this.analyticsService.exportMasterDetail(job.data);
      return;
    } catch (e) {
      throw new Error(`Err handleMyJob: ${e}`);
    }
  }

  @Process(`${process.env.EXCEL_PRICE_QUEUE_PROCESSOR}`)
  async handlePriceJob(job: Job<any>): Promise<any> {
    try {
      // Xử lý công việc ở đây
      await this.analyticsService.exportCheckPriceExcel(job.data);
      return;
    } catch (e) {
      throw new Error(`Err handleMyJob: ${e}`);
    }
  }

  @Process(`${process.env.EXCEL_CAMPAIGN_ORDER_DETAIL_PROCESSOR}`)
  async handleExportExcelCampaignDetailJob(job: Job<any>){
    try {
      await this.analyticsService.exportExcelCampaignDetail(job.data);
      return;
    } catch (e) {
      throw new Error(`Err handleExportExcelCampaignDetailJob: ${e}`);
    }
  }

  // @Process(JobName.ExportExcel)
  // async handleExportExcelCampaignDetailJob(job) {
  //   const jobData = job.data;

  //   switch (jobData.params.excelPage) {
  //     case pageFileName.campaignDetail: {
  //       await this.analyticsService.exportExcelCampaignDetail(jobData);
  //     }
  //     default: {
  //       break;
  //     }
  //   }
  // }
}
