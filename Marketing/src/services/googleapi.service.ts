import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { GoogleAdsApi } from "google-ads-api";
import { OAuth2Client } from 'google-auth-library';
import { Cache } from 'src/common';
import { RedisService } from './redis.service';
import { chunkAndExecPromiseAll, getDateFormat, getProtocol, isTokenExpired } from 'src/utilities/helper';
import { ElasticService } from 'src/modules/elastic/elastic.service';
import { channel, channelFlag } from 'src/common/commom';

@Injectable()
export class GoogleApiService {
  private readonly oauth2Client: OAuth2Client;
  constructor(
    protected redisService: RedisService,
    protected elasticService: ElasticService
  ) {
    const protocal: string = getProtocol()
    this.oauth2Client = new google.auth.OAuth2(
      process.env.CLIENT_ID,
      process.env.CLIENT_SECREAT,
      `${protocal}://${process.env.SITE_HOST}/analytics/google-ads-callback`
    );
  }

  async setCredentialFromRedis() {
    const key=`${process.env.APP_ENV}${Cache.GOOGLE_ADS_TOKEN}`;
    const credential = await this.redisService.get(key);
    if(credential){
      this.oauth2Client.setCredentials(credential);
    }
  }

  async getGoogleApiService(){
    const authorizationUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/drive.metadata.readonly',
        'https://www.googleapis.com/auth/adwords'
      ],
      include_granted_scopes: true,
      prompt: 'consent'
    });
    return authorizationUrl;
  }

  async exchangeCodeForToken(code: string): Promise<any> {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    await this.refreshAccessToken();
    return 'Token Update Successful';
  }

  // Function to refresh the access token
  async refreshAccessToken(): Promise<any> {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      this.oauth2Client.setCredentials(credentials);
      const key=`${process.env.APP_ENV}${Cache.GOOGLE_ADS_TOKEN}`;
      await this.redisService.set(key, credentials)
      return credentials;
    } catch (error) {
      throw error;
    }
  }
  
  // Function to refresh the access token
  async getShoppingPerformanceView(q: any): Promise<any> {
    try {
      await this.setCredentialFromRedis();
      const credentials = this.oauth2Client.credentials;
      const isExpire: boolean = isTokenExpired(credentials);
      if (isExpire) { 
        await this.refreshAccessToken();
      }
      const client = new GoogleAdsApi({
        client_id: `${process.env.CLIENT_ID}`, 
        client_secret: `${process.env.CLIENT_SECREAT}`, 
        developer_token: `${process.env.DEVELOP_TOCKEN_ADS}`, 
      });
      const customer = client.Customer({
        customer_id: process.env.CUSTOMER_ID,
        refresh_token: this.oauth2Client.credentials.access_token
      });
      const query = `
          SELECT shopping_performance_view.resource_name, 
            campaign.id,
            campaign.name,  
            segments.product_brand, 
            segments.product_title,
            segments.product_item_id,
            segments.date,
            metrics.clicks, 
            metrics.impressions,
            metrics.cost_micros,
            metrics.average_cpc,
            metrics.conversions,
            metrics.conversions_value
          FROM shopping_performance_view
          WHERE segments.date = '${q.date}'
        `;
      console.log('Executing query...');
      const shoppingViews: any[] = await customer.query(query);
      console.log('Query successfull');
      let i = 1;
      const data: any = [];
      for (const shopping of shoppingViews) {
        let item = {
          index: i++,
          campaign_name: shopping?.campaign?.name ?? "",
          campaign_id: shopping?.campaign?.id ?? "",
          sku: shopping?.segments?.product_item_id ?? "",
          date: shopping?.segments?.date ?? "",
          metric_clicks: shopping?.metrics?.clicks ?? "",
          metric_impressions: shopping?.metrics?.impressions ?? "",
          metric_costs: shopping?.metrics?.cost_micros / 1000000 ?? "",
          metric_conversions: shopping?.metrics?.conversions ?? "",
          metric_conv_values: shopping?.metrics?.conversions_value ?? "",
        };
        data.push(item);

      }
      const campaignPromises: any[] = data.map(async (shopping: any) => {
        const campaignParams: any = {
          campaignIds: [shopping.campaign_id],
          startDate: getDateFormat(shopping.date),
          endDate: getDateFormat(shopping.date),
        }
        const campaignResult: any[] = await this.elasticService.getCampaignByCondition(campaignParams);
        const transactionIds: any[] = campaignResult.filter((campaign) => campaign.transactionId !== "").map((campaign) => {
          return campaign.transactionId;
        })
        let revenueInside: number = 0;
        let purchaseInside: number = 0;
        if(transactionIds.length > 0){
          const analyticParams: any = {
            channels: [channel.ga4app, channel.ga4web],
            itemIds: [shopping.sku],
            itemOrderIds: transactionIds,
            channelFlags: [channelFlag.inside],
          }
          const analyticResult:any[] = await this.elasticService.getAnalyticsByCondition(analyticParams);
          if(analyticResult.length > 0){
            for (const analytic of analyticResult) {
              purchaseInside += analytic.itemsPurchasedInside;
              revenueInside += analytic.itemRevenueInside;
            }
          }
        }
        shopping.revenue_inside = revenueInside;
        shopping.purchase_inside = purchaseInside;
        return shopping;
      });
      
      const campaignResults: any[] = await chunkAndExecPromiseAll({chunkSize:50, array: campaignPromises});
      return {data : campaignResults, date: q.date};
    } catch (error) {
      console.log(error);
     return
    }
  }
}
