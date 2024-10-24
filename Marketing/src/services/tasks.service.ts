import {Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AnalyticsService } from 'src/modules/analytics/analytics.service';
import { ElasticService } from 'src/modules/elastic/elastic.service';
import { getDateNow, getLast7Days, getLastedDay } from 'src/utilities/helper';

@Injectable()
export class TasksService {
  constructor(
    private analyticService: AnalyticsService,
    private elasticService : ElasticService,
    ) {
  }

  @Cron('0 30 17 23 * *')
  async handleCron() {
    try {
      await this.analyticService.putMappingAnalyticsInfo();
      console.log('Start Run Import??????????????');
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const startDate = new Date("2024-08-15"); // Start of the current year
      const endDate = currentDate;
      const datesInRange: string[] = [];
    
      for (let date = startDate; date < endDate; date.setDate(date.getDate() + 1)) {
        const formattedDate = date.toISOString().split('T')[0];
        datesInRange.push(formattedDate);
      }
    
      for (const date of datesInRange) {
        console.log(`START RUN CRON JOB!!!! => ${date}`);
        const query = {
          startDateFirst: date,
          endDateFirst: date,
        };
        try {
            await this.analyticService.handleApiGAApp(query);
            await this.analyticService.handleApiGA4(query);
            await this.analyticService.handleApiInsideOrder(query);
            await this.analyticService.handleOfflineReceipt(query);
            await this.analyticService.handleApiInsideOrderCancel(query);
          console.log("OK!!!!");
        } catch (error) {
          console.error(error);
        }
      }
      console.log('End Run Import ??????????????');
    } catch (e) {
      console.log("Errors handleCron");
      console.log(e.message);
      throw e;
    }
  }

  @Cron('0 0 6 *  * *')
  async handleCronByLast7Day() {
    console.log('Start run handleCronByLast7Day ??????????????');
    try {
      const last7Days = getLast7Days();
      await this.elasticService.deleteGA4ForLast7Days(last7Days);
      for (const date of last7Days) {
        const query = {
          startDateFirst: date,
          endDateFirst: date,
        };
        await this.analyticService.handleApiGAApp(query),
        await this.analyticService.handleApiGA4(query)
      }

      const lastedDate: string = getLastedDay()
      const query = {
        startDateFirst: lastedDate,
        endDateFirst: lastedDate,
      };
      await this.analyticService.handleApiInsideOrder(query),
      await this.analyticService.handleOfflineReceipt(query),
      await this.analyticService.handleApiInsideOrderCancel(query);
    } catch (e) {
      console.log("Errors handleCronByLast7Day");
      console.log(e.message);
      throw e;
    }
  }

  @Cron('0 0 16 24 * *')
  async handleCronCampaign() {
    try {
      await this.analyticService.putMappingCampaignInfo();
      console.log('Start Run Campaign Import??????????????');
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const startDate = new Date("2024-08-15"); // Start of the current year
      const endDate = currentDate;
      const datesInRange: string[] = [];
    
      for (let date = startDate; date < endDate; date.setDate(date.getDate() + 1)) {
        const formattedDate = date.toISOString().split('T')[0];
        datesInRange.push(formattedDate);
      }
    
      for (const date of datesInRange) {
        console.log(`START RUN CRON JOB Campaign!!!! => ${date}`);
        const query = {
          startDateFirst: date,
          endDateFirst: date,
        };
    
        await this.analyticService.handleApiGAAppCampaign(query);
        await this.analyticService.handleApiGA4Campaign(query);
        console.log("OK!!!!");
      }
      console.log('End Run Import Campaign ??????????????');
    } catch (e) {
      console.log("Errors handleCronCampaign");
      console.log(e.message);
      throw e;
    }
  }

  @Cron('0 45 6 * * *')
  async handleCronCampaignLast7Day() {
    try {
      // Calculate the last 7 days
      const last7Days = getLast7Days();
      await this.elasticService.deleteCampaignDocumentsForLast7Days(last7Days);
      for (const date of last7Days) {
        console.log(`START RUN CRON JOB Campaign!!!! => ${date}`);
        const query = {
          startDateFirst: date,
          endDateFirst: date,
        };
        await this.analyticService.handleApiGAAppCampaign(query);
        await this.analyticService.handleApiGA4Campaign(query);
      }
      console.log('End Run Import Campaign');
    } catch (e) {
      console.log("Errors handleCronCampaignByDay");
      console.log(e.message);
      throw e;
    }
  }

  @Cron('0 0 1 * * *')
  async saveProductHealthAndBeautyToCache() {
    try {
      console.log('Start Save Product Health And Beauty To Cache ??????????????');
      this.analyticService.saveProductHealthAndBeautyToCache();
      console.log('End Save Product Health And Beauty To Cache ????');
    } catch (e) {
      console.log("Errors Save Product Health And Beauty To Cache");
      console.log(e.message);
      throw e;
    }
  }

  @Cron('*/30 * * * *')
  async handleGetDataPriceFromChannel() {
    try {
      console.log('Start Get handle Get Data Price From Channel ??????????????', getDateNow());
      console.log("start save product health and beauty to cache");
      await this.analyticService.saveProductHealthAndBeautyToCache();
      console.log('start get price on tiktok');
      await this.analyticService.getPriceOnTiktok();
      console.log('start get price on hasaki');
      await this.analyticService.getPriceOnHasaki();
      console.log('start get price on shopee');
      await this.analyticService.getPriceOnShopee();
      console.log('start get price on lazada');
      await this.analyticService.getPriceOnLazada();
      console.log('End Get handle Get Data Price From Channel ????');
    } catch (e) {
      console.log("Errors Get Data Price From Channel");
      console.log(e.message);
      throw e;
    }
  }

  @Cron('0 0 2 * * *')
  async handleDeleteDownloadFileByDay() {
    try {
      this.analyticService.deleteDownloadFileByDay()
    } catch (e) {
      console.log("Errors handleDeleteDownloadFileByDay");
      console.log(e.message);
      throw e;
    }
  }

  @Cron('0 30 17 24 * *')
  async handleShoppingPerformanceView() {
    try {
      await this.analyticService.putMappingShoppingPerformanceView();
      console.log('Start Run Shopping Performance View??????????????');
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const startDate = new Date("2024-08-15"); // Start of the current year
      const endDate = currentDate;
      const datesInRange: string[] = [];
      for (const date = startDate; date < endDate; date.setDate(date.getDate() + 1)) {
        const formattedDate = date.toISOString().split('T')[0];
        datesInRange.push(formattedDate);
      }
    
      for (const date of datesInRange) {
        console.log(`START Run Shopping Performance View!!!! => ${date}`);
        const query = {
          date,
        };
    
        await this.analyticService.handleShoppingPerformance(query);
        console.log("OK!!!!");
      }
      console.log('End Run Shopping Performance View ??????????????');
    } catch (e) {
      console.log("Errors Run Shopping Performance View");
      console.log(e.message);
      throw e;
    }
  }

  @Cron('0 0 8 * * *')
  async handleShoppingPerformanceViewLast7Days() {
    try {
      console.log('Start Run Shopping Performance View??????????????');
      const last7Days = getLast7Days();
      await this.elasticService.deleteShoppingDocumentsForLast7Days(last7Days);
      for (const date of last7Days) {
        console.log(`START Run Shopping Performance View!!!! => ${date}`);
        const query = {
          date,
        };
        await this.analyticService.handleShoppingPerformance(query);
      }
      console.log('End Run Shopping Performance View ??????????????');
    } catch (e) {
      console.log("Errors Run Shopping Performance View");
      console.log(e.message);
      throw e;
    }
  }
}