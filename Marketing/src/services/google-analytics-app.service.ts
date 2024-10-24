import { Injectable } from '@nestjs/common';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { containsHasakiClinicAndSpa, getObjectBySku } from 'src/utilities/helper';
import { channel } from 'src/common/commom';

type Dimension = { name: string };

@Injectable()
export class GoogleAnalyticsAppService {
  private readonly analyticsDataClient: BetaAnalyticsDataClient;
  private readonly propertyId: number = 184555586;
  constructor(
  ) {
    this.analyticsDataClient = new BetaAnalyticsDataClient({
      keyFilename: 'hasaki-operation.json', 
      scopes: ['https://www.googleapis.com/auth/analytics', 
              'https://www.googleapis.com/auth/analytics.readonly'
            ],
    });
  }

  async getItemsGAApp(query: any, dimensions: Dimension[], metrics: any, orderBys: any): Promise<any> {
    try {
      const [response] = await this.analyticsDataClient.runReport({
        property: `properties/${this.propertyId}`,
        dateRanges: [
          {
            startDate: query?.startDateFirst,
            endDate: query?.endDateFirst,
          },
        ],
        dimensions,
        metrics,
        orderBys,
        keepEmptyRows: false,
        limit: 250000,
        offset: 0
      });

      return response;

    } catch (e) {
      throw new Error(e.message);
    }
  }

  async handleApiGAApp(query: any, producs: any, channelFlag: string): Promise<any> {
    const dimensions: Dimension[] = [
      {
        name: "itemId"
      },
      {
        name: "date"
      },
      {
        name: "deviceCategory"
      },
      {
        name: "city"
      },
      {
        name: "sessionSourceMedium"
      },
      {
        name: "firstUserCampaignName"
      }
    ]
    const metrics: any = [
      {
        name: "itemsViewed"
      },
      {
        name: "itemsAddedToCart"
      },
      {
        name: "itemsCheckedOut"
      },
      {
        name: "itemsPurchased"
      },
      {
        name: "itemRevenue"
      },
    ];
    const orderBys: any = [
      {
        dimension: {
          orderType: "ALPHANUMERIC",
          dimensionName: "date"
        }
      },
      {
        dimension: {
          orderType: "ALPHANUMERIC",
          dimensionName: "itemId"
        }
      }
    ];
    const ga4 = await this.getItemsGAApp(query, dimensions, metrics, orderBys)
    const data: any = []
    await ga4.rows.forEach((e: any, index: any) => {
      const itemId = e.dimensionValues[0].value == "(not set)" ?  "0000000000000" : e.dimensionValues[0].value;
      const objBySku = getObjectBySku(itemId, producs, 'sku');
      const level2 = getObjectBySku('2', objBySku?.categories, 'level');
      const cate: string = level2?.name || "";
      if(containsHasakiClinicAndSpa(cate)){
        return;
      }
      const level3 = getObjectBySku('3', objBySku?.categories, 'level');
      const level4 = getObjectBySku('4', objBySku?.categories, 'level');
      let item = {
        index,
        itemId, 
        date: e.dimensionValues[1].value ?? "",
        itemName: objBySku?.name ?? "",
        channel: channel.ga4app,
        channelFlag,
        deviceCategory: e.dimensionValues[2].value ?? "",
        city: e.dimensionValues[3].value ?? "",
        sessionSourceMedium: e.dimensionValues[4].value ?? "",
        firstUserCampaignName: e.dimensionValues[5].value ?? "",
        itemProductType: "",
        itemInStore: "",
        region: channel.ga4app,

        itemCategory: level2?.name ?? "",
        itemCategory2: level3?.name ?? "",
        itemCategory3: level4?.name ?? "",
        itemBrand: objBySku?.productBrand?.name ?? "",
        vendor: objBySku?.vendorMaketing?.vendor_name ?? "",
        manufacture: objBySku?.country_of_manufacture ?? "",

        itemsViewed: parseInt(e.metricValues[0].value),
        itemsAddedToCart: parseInt(e.metricValues[1].value),
        itemsCheckedOut: parseInt(e.metricValues[2].value),
        itemsPurchased: parseInt(e.metricValues[3].value),
        itemsPurchasedInside: 0,
        itemRevenue: parseInt(e.metricValues[4].value),
        itemRevenueInside: 0,
        itemOrderId: "",
        itemCreatedDate: "",
        itemCompletedDate: "",
        itemActiveRule: 0,
        itemGifts: [],
        itemVouchers: [],
        itemChannelDetail: channel.ga4app,
        itemHasakiPrice: objBySku?.hsk_price ?? 0,
        orderCreateDate: '',
        orderUpdateDate: '',
      };
      data.push(item);
    });
    return {
      data,
      startDate: query?.startDateFirst,
      endDate: query?.endDateFirst,
    };
  }

  async handleCampain(query: any): Promise<any> {

    const dimensionsSessionCampaign: Dimension[] = [
      {
        name: "sessionCampaignName",
      },
      {
        name: "sessionCampaignId"
      },
      {
        name: "date"
      },
      {
        name: "transactionId"
      },
    ];

    const metricsSessionCampaign: any = [
      {
        name: "ecommercePurchases"
      },
      {
        name: "totalRevenue"
      }
    ];

    const orderBys: any = [
      {
        dimension: {
          orderType: "ALPHANUMERIC",
          dimensionName: "date"
        }
      }
    ];

    const dimensionsGoogleAdsCampaign: Dimension[] = [
      {
        name: "googleAdsCampaignName",
      },
      {
        name: "googleAdsCampaignId",
      },
      {
        name: "date"
      }
    ];
    const metricsGoogleAdsCampaign: any = [
      {
        name: "advertiserAdCost"
      }
    ];
    const ga4GoogleAdsCampaign = await this.getItemsGAApp(query, dimensionsGoogleAdsCampaign, metricsGoogleAdsCampaign, orderBys)
    let dataGoogleAds: any = []
    await ga4GoogleAdsCampaign.rows.forEach((e: any) => {
      const googleAdscampaignName = e.dimensionValues[0].value;
      const googleAdscampaignId = e.dimensionValues[1].value;
      const date = e.dimensionValues[2].value ?? "";
      let item = {
        googleAdscampaignName, 
        googleAdscampaignId,
        date,
        channel: channel.ga4app,

        advertiserAdCost: parseInt(e.metricValues[0].value),
      };
      dataGoogleAds.push(item);
    });

    const ga4SessionCampaign = await this.getItemsGAApp(query, dimensionsSessionCampaign, metricsSessionCampaign, orderBys);
    const dataSession: any = [];
    let campaignIds: any[] = [];
    await ga4SessionCampaign.rows.forEach((e: any) => {
      const campaignName = e.dimensionValues[0].value;
      const campaignId = e.dimensionValues[1].value;
      const date = e.dimensionValues[2].value ?? "";
      const transactionId = e.dimensionValues[3].value;
      let cost: number = 0;
      let coefficient: number = 0;
      if(!campaignIds.includes(campaignId)){
        const ad: any = dataGoogleAds.find((item: any) => item.googleAdscampaignId === campaignId)
        cost = ad ? ad?.advertiserAdCost : 0;
        coefficient = ad ? 1 : 0;
        campaignIds = [...campaignIds, campaignId];
        // delete object google ads
        if(ad){
          let index = dataGoogleAds.findIndex((item: any) => 
            item.googleAdscampaignName == ad?.googleAdscampaignName &&
            item.googleAdscampaignId == ad?.googleAdscampaignId 
          );
          dataGoogleAds.splice(index, 1);
        }
      }
      let item = {
        campaignName, 
        campaignId,
        date,
        channel: channel.ga4app,
        transactionId,

        advertiserAdCost: cost,
        coefficient,
        purchases: parseInt(e.metricValues[0].value),
        totalRevenue: parseInt(e.metricValues[1].value),
      };
      dataSession.push(item);
    });

    await dataGoogleAds.forEach((e: any) => {
      let item = {
        campaignName: e.googleAdscampaignName, 
        campaignId: e.googleAdscampaignId,
        date: e.date,
        channel: channel.ga4web,
        transactionId: "",

        advertiserAdCost: e.advertiserAdCost,
        coefficient: 1,
        purchases: 0,
        totalRevenue: 0,
      };
      dataSession.push(item);
    });

    return {
      data: dataSession,
      startDate: query?.startDateFirst,
      endDate: query?.endDateFirst,
    };
  }
}
