import { Injectable } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { Define } from 'src/common';
import { channel, channelFlag, maxPrice, statusFileDownload } from 'src/common/commom';
import { checkKeySourceExist, checkKeysExist, getFieldName, getIndexOfObject, getKeyInTerm, getFieldNameCampaign, cleanupFolders, getYesterdayTimestamps, checkIdInArrayExists, convertGADateFormat } from 'src/utilities/helper';
import { promises as fsPromises } from 'fs';
import { putMappingAnalyticsInfo, putMappingCampaignInfo, putMappingHistoryFileInfo, putMappingPriceInfo, putMappingShoppingPerformanceViewInfo } from 'src/common/mapping';
interface Terms {
  field: string;
}

interface Sort {
  [key: string]: { order: string };
}

type BulkIndexParams = {
  data: any[];
  chunkSize: number;
  getIdCallback: (dataItem: any, rowIndexed: number) => string;
  derivedDataItemCallback?: (dataItem: any, rowIndexed: number) => string;
  indexStr: string;
};

@Injectable()
export class ElasticService {
  private indexStr: string = process.env.EE_INDEX;
  private indexCamp: string = process.env.EE_CAMPAIGN;
  private indexPrice: string = process.env.EE_PRICE_INFO;
  private indexPriceHistory: string = process.env.EE_PRICE_HISTORY_INFO;
  private indexHistoryFile: string = process.env.EE_HISTORY_FILE;
  private indexShoppingPerformance: string = process.env.EE_SHOPPING_PERFORMANCE_VIEW;

  constructor(
    private readonly elasticsearchService: ElasticsearchService
    ) {
      this.updateFailDownloadFile();
    }

  async indexExist(index: string) {
    const exists = await this.elasticsearchService.indices.exists({
      index: index,
    });
    return exists;
  }

  async deleteIndex(index: string): Promise<any> {
    try {
      const response = await this.elasticsearchService.indices.delete({index});
      console.log("Delete Index Success: ", index);
      return response;
    } catch (error) {
      console.error("Delete Index Errors: ", error.message)
      return;
    }
  }

  async indexCampaignExist() {
    const exists = await this.elasticsearchService.indices.exists({
      index: this.indexCamp,
    });
    return exists;
  }

  async bulkIndexShoppingPerformace(
    params: Pick<
      BulkIndexParams,
      'data' | 'chunkSize' | 'derivedDataItemCallback' | 'getIdCallback'
    >,
  ) {
    await this.bulkIndex({ ...params, indexStr: this.indexShoppingPerformance });
  }

  async putMaxWindowPriceInfo() {
    const response = await this.elasticsearchService.indices.putSettings({
      index: this.indexPrice,
      body: {
        index: {
          max_result_window: maxPrice, // setting the new max_result_window
        }
      }
    });
    console.log('Settings updated price:', response);
    return response;

  }

  async putMappingShoppingPerformanceView() {
    const mappings = putMappingShoppingPerformanceViewInfo;
    return await this.createIndex(mappings, this.indexShoppingPerformance);
  }

  async searchESClient(index, query){
    console.log({query, index})
    try {
      const response = await this.search(index, query);
      return response;
    } catch (error) {
      console.error('Elasticsearch query error:', error);
      throw error;
    }
  }

  async deleteAllDocuments(index: string): Promise<any> {
    try {
      const response = await this.elasticsearchService.deleteByQuery({
        index,
        body: {
          query: {
            match_all: {}  // This will match all documents
          }
        }
      });
      console.log("Delete All Documents Success: ", index);
      return response;
    } catch (error) {
      console.error("Delete All Documents Errors: ", error.message);
      return;
    }
  }

  async deleteGA4ForLast7Days(dates: string[]): Promise<void> {
    for (const date of dates) {
      const formattedDate = date.replace(/-/g, '');
      await this.deleteGA4DocumentsByCondition(formattedDate, channel.ga4app, channelFlag.gaApp);
      await this.deleteGA4DocumentsByCondition(formattedDate, channel.ga4web, channelFlag.gaWeb);
    }
  }

  async deleteCampaignDocumentsForLast7Days(dates: string[]): Promise<void> {
    for (const date of dates) {
      const formattedDate = date.replace(/-/g, '');
      await this.deleteCampaignDocumentsByDate(formattedDate);
    }
  }

  async deleteShoppingDocumentsForLast7Days(dates: string[]): Promise<void> {
    for (const date of dates) {
      await this.deleteShoppingDocumentsByDate(date);
    }
  }

  async deleteGA4DocumentsByCondition(date: string, channel: string, channelFlag: string): Promise<any> {
    const response = await this.elasticsearchService.deleteByQuery({
      index: this.indexStr,
      body: {
        query: {
          bool: {
            must: [
                { term: { 'channel': channel } },
                { term: { 'channelFlag': channelFlag } },
                { term: { 'date': date } }
            ]
          }
        }
      }
    });
    return response;
  }

  async deleteCampaignDocumentsByDate(date: string): Promise<any> {
    const response = await this.elasticsearchService.deleteByQuery({
      index: this.indexCamp,
      body: {
        query: {
          term: {
            'date': date
          }
        }
      }
    });
    return response;
  }

  async deleteShoppingDocumentsByDate(date: string): Promise<any> {
    const response = await this.elasticsearchService.deleteByQuery({
      index: this.indexShoppingPerformance,
      body: {
        query: {
          term: {
            'date': date
          }
        }
      }
    });
    return response;
  }

  async deleteFileHistoryIndex(): Promise<any> {
    const response = await this.elasticsearchService.indices.delete({ index: this.indexHistoryFile });
    return response;
  }

  async deleteByQuery(query: any): Promise<any> {
    const body = {
      query: {
        bool: {
          should: query,
        },
      },
    };

    const response = await this.elasticsearchService.deleteByQuery({
      index: this.indexStr,
      body,
    });

    console.log('Documents deleted:', response);
  }

  async deleteBy(query: any): Promise<any> {
    const body = {
      query
    };
    const response = await this.elasticsearchService.deleteByQuery({
      index: this.indexStr,
      body,
    });
  }

  async bulkIndex({
    data,
    chunkSize = 3000,
    getIdCallback,
    derivedDataItemCallback,
    indexStr,
  }: BulkIndexParams) {
    console.time('bulkIndexTime');
    console.log(`Begin bulkIndex ${data.length} items`);

    let operations = [];
    let rowIndexed = 0;
    for (const dataItem of data) {
      /* Preparing bulk data */
      rowIndexed = rowIndexed + 1;
      const derivedDataItem = derivedDataItemCallback
        ? derivedDataItemCallback(dataItem, rowIndexed)
        : dataItem;
      operations.push(
        {
          index: {
            _index: indexStr,
            _id: getIdCallback(dataItem, rowIndexed),
          },
        },
        derivedDataItem,
      );

      /* Begin insert bulk data, chunkSize * 2 because of including metadata and data */
      if (operations.length >= chunkSize * 2) {
        await this.elasticsearchService.bulk({
          operations,
          refresh: true,
        });
        operations = [];
      }
    }

    /* Index remain data  */
    if (operations.length > 0) {
      await this.elasticsearchService.bulk({
        operations,
        refresh: true,
      });
    }
    console.timeEnd('bulkIndexTime');
    return;
  }

  async bulkIndexAnalytics(
    params: Pick<
      BulkIndexParams,
      'data' | 'chunkSize' | 'derivedDataItemCallback' | 'getIdCallback'
    >,
  ) {
    await this.bulkIndex({ ...params, indexStr: this.indexStr });
  }

  async index(data: any, id: string) {
    const response = await this.elasticsearchService.index({
      index: this.indexStr,
      id,
      body: {
        ...data,
      },
    });

    return response;
  }

  async bulkIndexCampaign(
    params: Pick<
      BulkIndexParams,
      'data' | 'chunkSize' | 'derivedDataItemCallback' | 'getIdCallback'
    >,
  ) {
    await this.bulkIndex({ ...params, indexStr: this.indexCamp });
  }

  async indexCampaign(data: any, id: string) {
    const response = await this.elasticsearchService.index({
      index: this.indexCamp,
      id,
      body: {
        ...data,
      },
    });

    return response;
  }

  async indexDownloadFileES(data: any, id: string) {
    const response = await this.elasticsearchService.index({
      index: this.indexHistoryFile,
      id,
      body: {
        ...data,
      },
    });

    return response;
  }

  async bulkIndexPriceInfo(
    params: Pick<
      BulkIndexParams,
      'data' | 'chunkSize' | 'derivedDataItemCallback' | 'getIdCallback'
    >,
  ) {
    await this.bulkIndex({ ...params, indexStr: this.indexPrice });
  }

  async createIndex(mappings: any, index: string) {
    try {
      const isExist: boolean = await this.indexExist(index);
      if (isExist){
        await this.deleteIndex(index)
      }
      await this.elasticsearchService.indices.create({
        index,
        body: {
          mappings: {
            properties: mappings,
          },
        },
      });
      console.log("Create Index Success: ", index);
      return true
    } catch (error) {
      console.log( `error create index ${index}:`, error.message);
      return;
    }
  }

  async putMappingPriceInfo() {
    const mappings = putMappingPriceInfo;
    return await this.createIndex(mappings, this.indexPrice);
  }

  async putMappingAnalyticsInfo() {
    const mappings = putMappingAnalyticsInfo;
    return await this.createIndex(mappings, this.indexStr);
  }

  async putMappingCampaignInfo() {
    const mappings = putMappingCampaignInfo;
    return await this.createIndex(mappings, this.indexCamp);
  }

  async putMappingHistoryFileInfo() {
    const mappings = putMappingHistoryFileInfo;
    return await this.createIndex(mappings, this.indexHistoryFile);
  }

  async indexPriceInfo(data: any, id: string) {
    const response = await this.elasticsearchService.index({
      index: this.indexPrice,
      id,
      body: {
        ...data,
      },
    });

    return response;
  }

  async bulkIndexPriceHistoryInfo(
    params: Pick<
      BulkIndexParams,
      'data' | 'chunkSize' | 'derivedDataItemCallback' | 'getIdCallback'
    >,
  ) {
    await this.bulkIndex({
      ...params,
      indexStr: this.indexPriceHistory,
    });
    return;
  }

  async indexPriceHistoryInfo(data: any, id: string) {
    const response = await this.elasticsearchService.index({
      index: this.indexPriceHistory,
      id,
      body: {
        ...data,
      },
    });

    return response;
  }

  async runAggregation(query: any, ids: string[], idsNegative: string[]): Promise<any> {
    const terms: Terms[] = query?.terms ? JSON.parse(query.terms) : null;
    const sources: any = this.getMultiTerm(query, terms);
    const sourcesByItem: any = this.getMultiTermByItem(terms);

    const isCompare: boolean = query.isCompare !== "false";
    const exactSearch: boolean = query.exactSearch !== "false";
    let field: string = getFieldName(query.type);
    let tabSearch: string = field?.split('.')[0];
    const totalFirstParams = this.totalQuery(query.search, query.startDateFirst, query.endDateFirst, tabSearch, exactSearch, ids, idsNegative, query.filter);
    const totalSecondParams = this.totalQuery(query.search, query.startDateSecond, query.endDateSecond, tabSearch, exactSearch, ids, idsNegative, query.filter);
    const bodyFirstParams = this.bodyQuery(query, query.startDateFirst, query.endDateFirst, sources, tabSearch, exactSearch, ids, idsNegative);
    const [totalFirst, totalSecond, bodyFirst] = await Promise.all([
      this.search(this.indexStr, totalFirstParams),
      this.search(this.indexStr, totalSecondParams),
      this.search(this.indexStr, bodyFirstParams),
    ]);
    let total: {} = {};
    const body: any[] = [];
    const dates = [`${query.startDateFirst}-${query.endDateFirst}`, `${query.startDateSecond}-${query.endDateSecond}`];
    const totalPage = Math.ceil(bodyFirst?.aggregations?.total_buckets?.value / query.pageNumber);
    if (!isCompare) {
      total = this.getTotals(query, totalFirst);
      let itemId: string = "";
      let totalRevenueBySKU: number = 0;
      let totalRevenueInsideBySKU: number = 0;
      for (const e of bodyFirst.aggregations.items.buckets) {
        const item: any = {
          key: e.key,
          [`${query.startDateFirst}-${query.endDateFirst}`]: {
            itemsViewed: this.getItemMetric(e.itemsViewed?.value, "Items viewed"),
            itemsAddedToCart: this.getItemMetric(e.itemsAddedToCart?.value, "Items add to cart"),
            itemsCheckedOut: this.getItemMetric(e.itemsCheckedOut?.value, "Items checkout"),
            itemsPurchased: this.getItemMetric(e.itemsPurchased?.value, "Items purchased"),
            itemRevenue: this.getItemMetric(e.itemRevenue?.value, "Items revenue"),
            itemsPurchasedInside: this.getItemMetric(e.itemsPurchasedInside?.value, "Items purchased inside"),
            itemRevenueInside: this.getItemMetric(e.itemRevenueInside?.value, "Items revenue inside"),
            carttoDetailRate: this.getItemMetric(e.carttoDetailRate?.value, "Cart to detail rate"),
            buytoDetailRate: this.getItemMetric(e.buytoDetailRate?.value, "Buy to detail rate")
          }
        };
        const hasKeySessionSourceMedium = checkKeysExist(terms, "sessionSourceMedium");
        const hasKeyChannel = checkKeysExist(terms, "channel");
        if ((query.type === Define.Type.sku || query.type === Define.Type.channel) && (hasKeySessionSourceMedium || hasKeyChannel)) {
          const index = getIndexOfObject(terms, "itemId");
          const keys: [] = Array.isArray(e.key) ? e.key : [e.key];
          if (itemId != keys[index]) {
            itemId = keys[index];
            const totalParamsBySku = this.totalQuery(itemId, query.startDateFirst, query.endDateFirst, tabSearch, exactSearch, ids,idsNegative, query.filter);
            const [total] = await Promise.all([
              this.search(this.indexStr, totalParamsBySku)
            ]);
            totalRevenueBySKU = total?.aggregations?.itemRevenue?.value;
            totalRevenueInsideBySKU = total?.aggregations?.itemRevenueInside?.value;
          }
          let revenueBySkuPercent: number = 0;
          let revenueInsideBySkuPercent: number = 0;

          revenueBySkuPercent = (e.itemRevenue?.value / totalRevenueBySKU) * 100;
          revenueInsideBySkuPercent = (e.itemRevenueInside?.value / totalRevenueInsideBySKU) * 100;
          
          item[`${query.startDateFirst}-${query.endDateFirst}`].revenueBySkuPercent = this.getItemMetric(revenueBySkuPercent, "Revenue/SKU revenue (%)");
          item[`${query.startDateFirst}-${query.endDateFirst}`].revenueInsideBySkuPercent = this.getItemMetric(revenueInsideBySkuPercent, "Revenue Inside/SKU revenue inside (%)");
        }
        body.push(item);
      }
    } else {
      total = this.getComparisonTotals(query, totalFirst, totalSecond);
      let itemId: string = "";
      let totalRevenueByFirst: number = 0;
      let totalRevenueBySecond: number = 0;

      let totalRevenueInsideByFirst: number = 0;
      let totalRevenueInsideBySecond: number = 0;
      for (const e of bodyFirst.aggregations.items.buckets) {
        const keys: [] = Array.isArray(e.key) ? e.key : [e.key];
        const obj = Object.entries(keys).map(([key, value]) => (
          {
            match: {
              [getKeyInTerm(parseInt(key), terms)]: value
            }
          }
        ));
        const range: {} = {
          range: {
            date: {
              gte: query.startDateSecond,
              lte: query.endDateSecond
            }
          }
        }
        const must = [...obj, range]
        const queryParams = this.bodyQueryByItem(sourcesByItem, must);
        const itemByKey = await this.search(this.indexStr, queryParams);
        const buckets = itemByKey.aggregations.items.buckets[0];
        const item: any = {
          key: e.key,
          [`${query.startDateFirst}-${query.endDateFirst}`]: this.formatMetrics(e),
          [`${query.startDateSecond}-${query.endDateSecond}`]: this.formatMetrics(buckets),
          'percent': {
            itemsViewed: this.getItemMetric(buckets ? this.calculatePercent(e.itemsViewed.value, buckets.itemsViewed.value) : null, 'Items viewed'),
            itemsAddedToCart: this.getItemMetric(buckets ? this.calculatePercent(e.itemsAddedToCart.value, buckets.itemsAddedToCart.value) : null, 'Items add to cart'),
            itemsCheckedOut: this.getItemMetric(buckets ? this.calculatePercent(e.itemsCheckedOut.value, buckets.itemsCheckedOut.value) : null, 'Items checkout'),
            itemsPurchased: this.getItemMetric(buckets ? this.calculatePercent(e.itemsPurchased.value, buckets.itemsPurchased.value) : null, 'Items purchased'),
            itemRevenue: this.getItemMetric(buckets ? this.calculatePercent(e.itemRevenue.value, buckets.itemRevenue.value) : null, 'Items revenue'),
            itemsPurchasedInside: this.getItemMetric(buckets ? this.calculatePercent(e.itemsPurchasedInside.value, buckets.itemsPurchasedInside.value) : null, 'Items purchased inside'),
            itemRevenueInside: this.getItemMetric(buckets ? this.calculatePercent(e.itemRevenueInside.value, buckets.itemRevenueInside.value) : null, 'Items revenue inside'),
            carttoDetailRate: this.getItemMetric(buckets ? this.calculatePercent(e.carttoDetailRate.value, buckets.carttoDetailRate.value) : null, 'Cart to detail rate'),
            buytoDetailRate: this.getItemMetric(buckets ? this.calculatePercent(e.buytoDetailRate.value, buckets.buytoDetailRate.value) : null, 'Buy to detail rate'),
          }
        };
        const hasKeySessionSourceMedium = checkKeysExist(terms, "sessionSourceMedium");
        const hasKeyChannel = checkKeysExist(terms, "channel");
        if (query.type === Define.Type.sku && (hasKeySessionSourceMedium || hasKeyChannel)) {
          const index = getIndexOfObject(terms, "itemId");
          if (itemId != keys[index]) {
            itemId = keys[index];
            const totalParamsBySkuFirst = this.totalQuery(itemId, query.startDateFirst, query.endDateFirst, tabSearch, exactSearch, ids, idsNegative, query.filter);
            const totalParamsBySkuSecond = this.totalQuery(itemId, query.startDateSecond, query.endDateSecond, tabSearch, exactSearch, ids, idsNegative, query.filter);
            const [totalFirst, totalSecond] = await Promise.all([
              this.search(this.indexStr, totalParamsBySkuFirst),
              this.search(this.indexStr, totalParamsBySkuSecond)
            ]);
            totalRevenueByFirst = totalFirst?.aggregations?.itemRevenue?.value;
            totalRevenueBySecond = totalSecond?.aggregations?.itemRevenue?.value;

            totalRevenueInsideByFirst = totalFirst?.aggregations?.itemRevenueInside?.value;
            totalRevenueInsideBySecond = totalSecond?.aggregations?.itemRevenueInside?.value;
          }
          let revenueBySkuPercentFirst: number = 0;
          let revenueBySkuPercentSecond: number = 0;

          let revenueBySkuInsidePercentFirst: number = 0;
          let revenueBySkuInsidePercentSecond: number = 0;

          revenueBySkuPercentFirst = (e?.itemRevenue?.value / totalRevenueByFirst) * 100;
          revenueBySkuPercentSecond = (buckets?.itemRevenue?.value / totalRevenueBySecond) * 100;

          revenueBySkuInsidePercentFirst = (e?.itemRevenueInside?.value / totalRevenueInsideByFirst) * 100;
          revenueBySkuInsidePercentSecond = (buckets?.itemRevenueInside?.value / totalRevenueInsideBySecond) * 100;

          item[`${query.startDateFirst}-${query.endDateFirst}`].revenueBySkuPercent = this.getItemMetric(revenueBySkuPercentFirst, "Revenue/SKU revenue (%)");
          item[`${query.startDateSecond}-${query.endDateSecond}`].revenueBySkuPercent = this.getItemMetric(revenueBySkuPercentSecond, "Revenue/SKU revenue (%)");
          item[`percent`].revenueBySkuPercent = this.getItemMetric(this.calculatePercent(revenueBySkuPercentFirst, revenueBySkuPercentSecond), "Revenue/SKU revenue (%)");

          item[`${query.startDateFirst}-${query.endDateFirst}`].revenueInsideBySkuPercent = this.getItemMetric(revenueBySkuInsidePercentFirst, "Revenue inside/SKU revenue inside (%)");
          item[`${query.startDateSecond}-${query.endDateSecond}`].revenueInsideBySkuPercent = this.getItemMetric(revenueBySkuInsidePercentSecond, "Revenue inside/SKU revenue inside (%)");
          item[`percent`].revenueInsideBySkuPercent = this.getItemMetric(this.calculatePercent(revenueBySkuPercentFirst, revenueBySkuInsidePercentSecond), "Revenue inside/SKU revenue inside (%)");
        }
        body.push(item);
      }
    }
    return {
      isCompare,
      dates,
      total,
      body,
      totalPage,
      terms
    };
  }

  getTotals(query: any, totalFirst: any): any {
    return {
      [`${query.startDateFirst}-${query.endDateFirst}`]: {
        itemsViewed: this.getItemMetric(totalFirst?.aggregations?.itemsViewed?.value, "Items viewed"),
        itemsAddedToCart: this.getItemMetric(totalFirst?.aggregations?.itemsAddedToCart?.value, "Items add to cart"),
        itemsCheckedOut: this.getItemMetric(totalFirst?.aggregations?.itemsCheckedOut?.value, "Items checkout"),
        itemsPurchased: this.getItemMetric(totalFirst?.aggregations?.itemsPurchased?.value, "Items purchased"),
        itemRevenue: this.getItemMetric(totalFirst?.aggregations?.itemRevenue?.value, "Items revenue"),
        itemsPurchasedInside: this.getItemMetric(totalFirst?.aggregations?.itemsPurchasedInside?.value, "Items purchased inside"),
        itemRevenueInside: this.getItemMetric(totalFirst?.aggregations?.itemRevenueInside?.value, "Items revenue inside"),
        carttoDetailRate: this.getItemMetric((totalFirst?.aggregations?.itemsAddedToCart.value / totalFirst?.aggregations?.itemsViewed?.value) * 100, "Cart to detail rate"),
        buytoDetailRate: this.getItemMetric((totalFirst?.aggregations?.itemsPurchased.value / totalFirst?.aggregations?.itemsViewed?.value) * 100, "Buy to detail rate"),
      }
    };
  }

  getComparisonTotals(query: any, totalFirst: any, totalSecond: any): any {
    return {
      [`${query.startDateFirst}-${query.endDateFirst}`]: this.formatMetrics(totalFirst.aggregations),
      [`${query.startDateSecond}-${query.endDateSecond}`]: this.formatMetrics(totalSecond.aggregations),
      'percent': {
        itemsViewed: this.getItemMetric(this.calculatePercent(totalFirst.aggregations.itemsViewed.value, totalSecond.aggregations.itemsViewed.value), "Items viewed"),
        itemsAddedToCart: this.getItemMetric(this.calculatePercent(totalFirst.aggregations.itemsAddedToCart.value, totalSecond.aggregations.itemsAddedToCart.value), "Items add to cart"),
        itemsCheckedOut: this.getItemMetric(this.calculatePercent(totalFirst.aggregations.itemsCheckedOut.value, totalSecond.aggregations.itemsCheckedOut.value), "Items checkout"),
        itemsPurchased: this.getItemMetric(this.calculatePercent(totalFirst.aggregations.itemsPurchased.value, totalSecond.aggregations.itemsPurchased.value), "Items purchased"),
        itemRevenue: this.getItemMetric(this.calculatePercent(totalFirst.aggregations.itemRevenue.value, totalSecond.aggregations.itemRevenue.value), "Items revenue"),
        itemsPurchasedInside: this.getItemMetric(this.calculatePercent(totalFirst.aggregations.itemsPurchasedInside.value, totalSecond.aggregations.itemsPurchasedInside.value), "Items purchased inside"),
        itemRevenueInside: this.getItemMetric(this.calculatePercent(totalFirst.aggregations.itemRevenueInside.value, totalSecond.aggregations.itemRevenueInside.value), "Items revenue inside"),
        carttoDetailRate: this.getItemMetric(this.calculatePercent((totalFirst.aggregations.itemsAddedToCart.value / totalFirst.aggregations.itemsViewed.value) * 100, (totalSecond.aggregations.itemsAddedToCart.value / totalSecond.aggregations.itemsViewed.value) * 100), "Cart to detail rate"),
        buytoDetailRate: this.getItemMetric(this.calculatePercent((totalFirst.aggregations.itemsPurchased.value / totalFirst.aggregations.itemsViewed.value) * 100, (totalSecond.aggregations.itemsPurchased.value / totalSecond.aggregations.itemsViewed.value) * 100), "Buy to detail rate")
      }
    };
  }

  getItemMetric(value: any, name: string) {
    return {
      value,
      name
    };
  }

  async search(index: string, body: any): Promise<any> {
    const result = await this.elasticsearchService.search({
      index,
      body
    });
    return result;
  }

  totalQuery(search: string, startDate: string, endDate: string, tabSearch: string, exactSearch: boolean, ids: string[], idsNegative: string[], filters: string): object {
    const q: any = {
      track_total_hits: true,
      query: {
        bool: {
          must: [
            {
              range: {
                date: {
                  gte: startDate,
                  lte: endDate
                }
              }
            }
          ],
          must_not: [
            {
              match: {
                channel: 'Online'
              }
            }
          ]
        }
      },
      size: 0,
      aggs: {
        itemsViewed: this.createSumAggregation("itemsViewed"),
        itemsAddedToCart: this.createSumAggregation("itemsAddedToCart"),
        itemsCheckedOut: this.createSumAggregation("itemsCheckedOut"),
        itemsPurchased: this.createSumAggregation("itemsPurchased"),
        itemRevenue: this.createSumAggregation("itemRevenue"),
        itemsPurchasedInside: this.createSumAggregation("itemsPurchasedInside"),
        itemRevenueInside: this.createSumAggregation("itemRevenueInside")
      }
    }
    if (search) {
      let searchQuery:any = {
        bool: {
          should: [
            {
              match: {
                [tabSearch]: {
                  query: search
                }
              }
            }
          ]
        }
      };
    
      if (exactSearch) {
        searchQuery.bool.should[0].match[tabSearch].minimum_should_match = "100%";
      }
    
      q.query.bool.must.push(searchQuery);
    }

    if(ids.length > 0 && ids) {
      let terms: any = {
        terms: {
          "itemId": ids 
        }
      }
      q.query.bool.must.push(terms);
    }

    if(idsNegative.length > 0 && idsNegative) {
      let terms: any = {
        terms: {
          "itemId": idsNegative 
        }
      }
      q.query.bool.must_not.push(terms);
    }

    if (filters) {
      const filterValues = JSON.parse(filters);
      const query_string: any = {
        query_string: {
          query: '',
          default_operator: 'AND'
        },
      };
      const filterArr = [];
      const filterKeys = ['sessionSourceMedium', 'firstUserCampaignName', 'channel', 'region', 'city', 'itemId'];
      for (let key of filterKeys) {
        if (key in filterValues) {
          filterValues[key] = filterValues[key].replace(/[.+*?^${}()|[\]\\/]/g, '');
          filterArr.push(`${key}: (*${filterValues[key]}*)`);
        }
      }
      query_string.query_string.query = filterArr.join(' AND ');
      q.query.bool.must.push(query_string);
    }
    
    return q;
  }

  bodyQuery(query: any, startDate: string, endDate: string, sources: any, tabSearch: string, exactSearch: boolean, ids: string[], idsNegative: string[]): object {
    const q: any = {
      track_total_hits: true,
      query: {
        bool: {
          must: [
            {
              range: {
                date: {
                  gte: startDate,
                  lte: endDate
                }
              }
            }
          ],
          must_not: [
            {
              match: {
                channel: 'Online'
              }
            }
          ]
        }
      },
      size: 0,
      aggs: {
        items: {
          aggs: {
            itemsViewed: this.createSumAggregation("itemsViewed"),
            itemsAddedToCart: this.createSumAggregation("itemsAddedToCart"),
            itemsCheckedOut: this.createSumAggregation("itemsCheckedOut"),
            itemsPurchased: this.createSumAggregation("itemsPurchased"),
            itemRevenue: this.createSumAggregation("itemRevenue"),
            itemsPurchasedInside: this.createSumAggregation("itemsPurchasedInside"),
            itemRevenueInside: this.createSumAggregation("itemRevenueInside"),
            carttoDetailRate: {
              bucket_script: {
                buckets_path: {
                  itemsAddedToCart: "itemsAddedToCart",
                  itemsViewed: "itemsViewed"
                },
                script: "params.itemsAddedToCart / params.itemsViewed * 100"
              }
            },
            buytoDetailRate: {
              bucket_script: {
                buckets_path: {
                  itemsPurchased: "itemsPurchased",
                  itemsViewed: "itemsViewed"
                },
                script: "params.itemsPurchased / params.itemsViewed * 100"
              }
            },
            analytics_bucket_sort: {
              bucket_sort: {
                size: Number(query.pageNumber),
                from: (query.pageNumber * query.page) - query.pageNumber,
              }
            }
          }
        }
      }
    };
    let scriptArr :string[] = []

    if (sources?.multi_terms) {
      q.aggs.items = {
        multi_terms: {
          ...sources.multi_terms,
        },
        ...q.aggs.items
      };
      scriptArr = sources?.multi_terms?.terms.map((obj: any) => obj.field);
    } else if (sources?.terms) {
      q.aggs.items = {
        terms: {
          ...sources.terms,
        },
        ...q.aggs.items
      };
      scriptArr = [...scriptArr, sources?.terms?.field];
    }

    if (scriptArr.length > 0) {
      const script = "emit(" + scriptArr.map(elem => `doc['${elem}'].value`).join(' + ') + ")";
      const runtime_mappings = {
        totals: {
          type: "keyword",
          script,
        },
      };
      q.runtime_mappings = runtime_mappings;
      const total_buckets = {
        cardinality: {
          field: "totals",
          precision_threshold: 40000,
        }
      }
      q.aggs.total_buckets = total_buckets
    }

    if (query.search) {
      let searchQuery: any = {
        bool: {
          should: [
            {
              match: {
                [tabSearch]: {
                  query: query.search
                }
              }
            }
          ]
        }
      };
      if (exactSearch) {
        searchQuery.bool.should[0].match[tabSearch].minimum_should_match = "100%";
      }
      q.query.bool.must.push(searchQuery);
    }

    if(ids.length > 0 && ids) {
      let terms: any = {
        terms: {
          "itemId": ids 
        }
      }
      q.query.bool.must.push(terms);
    }

    if(idsNegative.length > 0 && idsNegative){
      let terms: any = {
        terms: {
          "itemId": idsNegative 
        }
      }
      q.query.bool.must_not.push(terms);
    }
    
    if (query.filter) {
      const filters = JSON.parse(query.filter);
      const query_string: any = {
        query_string: {
          query: '',
          default_operator: 'AND'
        },
      };
      const filterArr = [];
      const filterKeys = ['sessionSourceMedium', 'firstUserCampaignName', 'channel', 'region', 'city', 'itemId'];
      for (let key of filterKeys) {
        if (key in filters) {
          filters[key] = filters[key].replace(/[.+*?^${}()|[\]\\/]/g, '');
          filterArr.push(`${key}: (*${filters[key]}*)`);
        }
      }
      query_string.query_string.query = filterArr.join(' AND ');
      q.query.bool.must.push(query_string);
    }

    return q;
  }

  bodyQueryByItem(sources: any, must: any): Object {
    const q: any = {
      query: {
        bool: {
          must: must,
          must_not: [
            {
              match: {
                channel: 'Online'
              }
            }
          ]
        }
      },
      size: 0,
      aggs: {
        items: {
          aggs: {
            itemsViewed: this.createSumAggregation("itemsViewed"),
            itemsAddedToCart: this.createSumAggregation("itemsAddedToCart"),
            itemsCheckedOut: this.createSumAggregation("itemsCheckedOut"),
            itemsPurchased: this.createSumAggregation("itemsPurchased"),
            itemRevenue: this.createSumAggregation("itemRevenue"),
            itemsPurchasedInside: this.createSumAggregation("itemsPurchasedInside"),
            itemRevenueInside: this.createSumAggregation("itemRevenueInside"),
            carttoDetailRate: {
              bucket_script: {
                buckets_path: {
                  itemsAddedToCart: "itemsAddedToCart",
                  itemsViewed: "itemsViewed"
                },
                script: "params.itemsAddedToCart / params.itemsViewed * 100"
              }
            },
            buytoDetailRate: {
              bucket_script: {
                buckets_path: {
                  itemsPurchased: "itemsPurchased",
                  itemsViewed: "itemsViewed"
                },
                script: "params.itemsPurchased / params.itemsViewed * 100"
              }
            }
          }
        }
      }
    }
    if (sources.multi_terms) {
      q.aggs.items = {
        multi_terms: {
          ...sources.multi_terms,
        },
        ...q.aggs.items
      };
    } else if (sources.terms) {
      q.aggs.items = {
        terms: {
          ...sources.terms,
        },
        ...q.aggs.items
      };
    }
    return q;
  }

  trackingSkuQuery(query: any, startDate: string, endDate: string, sources: any, tabSearch: string, exactSearch: boolean, filter: any): object {
    const q: any = {
      track_total_hits: true,
      query: {
        bool: {
          must: [
            {
              range: {
                date: {
                  gte: startDate,
                  lte: endDate
                }
              }
            }
          ],
          must_not: [
            {
              match: {
                channel: 'Online'
              }
            }
          ]
        }
      },
      size: 0,
      aggs: {
        items: {
          aggs: {
            itemsPurchasedInside: this.createSumAggregation("itemsPurchasedInside"),
            itemRevenueInside: this.createSumAggregation("itemRevenueInside"),
            analytics_bucket_sort: {
              bucket_sort: {
                size: Number(query.pageNumber),
                from: (query.pageNumber * query.page) - query.pageNumber,
              }
            }
          }
        }
      }
    };
    let scriptArr :string[] = []

    if (sources?.multi_terms) {
      q.aggs.items = {
        multi_terms: {
          ...sources.multi_terms,
        },
        ...q.aggs.items
      };
      scriptArr = sources?.multi_terms?.terms.map((obj: any) => obj.field);
    } else if (sources?.terms) {
      q.aggs.items = {
        terms: {
          ...sources.terms,
        },
        ...q.aggs.items
      };
      scriptArr = [...scriptArr, sources?.terms?.field];
    }

    if (scriptArr.length > 0) {
      const script = "emit(" + scriptArr.map(elem => `doc['${elem}'].value`).join(' + ') + ")";
      const runtime_mappings = {
        totals: {
          type: "keyword",
          script,
        },
      };
      q.runtime_mappings = runtime_mappings;
      const total_buckets = {
        cardinality: {
          field: "totals",
          precision_threshold: 40000,
        }
      }
      q.aggs.total_buckets = total_buckets
    }

    if (query.search) {
      let searchQuery: any = {
        bool: {
          should: [
            {
              match: {
                [tabSearch]: {
                  query: query.search
                }
              }
            }
          ]
        }
      };
      if (exactSearch) {
        searchQuery.bool.should[0].match[tabSearch].minimum_should_match = "100%";
      }
      q.query.bool.must.push(searchQuery);
    }

    if (filter && filter.length > 0) {
      q.query.bool.filter = filter
    }

    return q;
  }

  trackingSkuQueryByItem(sources: any, must: any): Object {
    const q: any = {
      query: {
        bool: {
          must: must,
          must_not: [
            {
                match: {
                    channel: "Online",
                }
            }
          ]
        }
      },
      size: 0,
      aggs: {
        items: {
          aggs: {
            itemsPurchasedInside: this.createSumAggregation("itemsPurchasedInside"),
            itemRevenueInside: this.createSumAggregation("itemRevenueInside")
          }
        }
      }
    }
    if (sources.multi_terms) {
      q.aggs.items = {
        multi_terms: {
          ...sources.multi_terms,
        },
        ...q.aggs.items
      };
    } else if (sources.terms) {
      q.aggs.items = {
        terms: {
          ...sources.terms,
        },
        ...q.aggs.items
      };
    }
    return q;
  }
  trackingCostSkuQueryByItem(sources: any, must: any): Object {
    const q: any = {
      query: {
        bool: {
          must: must
        }
      },
      size: 0,
      aggs: {
        items: {
          aggs: {
            metricClicks: this.createSumAggregation("metric_clicks"),
            metricCosts: this.createSumAggregation("metric_costs"),
            metricConversions: this.createSumAggregation("metric_conversions"),
            metricConversionValues: this.createSumAggregation("metric_conv_values"),
            purchaseInside: this.createSumAggregation("purchase_inside"),
            revenueInside: this.createSumAggregation("revenue_inside"),
          }
        }
      }
    }
    if (sources.multi_terms) {
      q.aggs.items = {
        multi_terms: {
          ...sources.multi_terms,
        },
        ...q.aggs.items
      };
    } else if (sources.terms) {
      q.aggs.items = {
        terms: {
          ...sources.terms,
        },
        ...q.aggs.items
      };
    }
    return q;
  }

  formatMetrics(aggregations: any) {
    return {
      itemsViewed: this.getItemMetric(aggregations?.itemsViewed?.value ?? null, "Items viewed"),
      itemsAddedToCart: this.getItemMetric(aggregations?.itemsAddedToCart?.value ?? null, "Items add to cart"),
      itemsCheckedOut: this.getItemMetric(aggregations?.itemsCheckedOut?.value ?? null, "Items checkout"),
      itemsPurchased: this.getItemMetric(aggregations?.itemsPurchased?.value ?? null, "Items purchased"),
      itemRevenue: this.getItemMetric(aggregations?.itemRevenue?.value ?? null, "Items revenue"),
      itemsPurchasedInside: this.getItemMetric(aggregations?.itemsPurchasedInside?.value ?? null, "Items purchased inside"),
      itemRevenueInside: this.getItemMetric(aggregations?.itemRevenueInside?.value ?? null, "Items revenue inside"),
      carttoDetailRate: this.getItemMetric(aggregations?.itemsAddedToCart?.value / aggregations?.itemsViewed?.value ?? null, "Cart to detail rate"),
      buytoDetailRate: this.getItemMetric(aggregations?.itemsPurchased?.value / aggregations?.itemsViewed?.value ?? null, "Buy to detail rate"),
    };
  };

  formatMetricsTrackingSku(aggregations: any) {
    return {
      itemsPurchasedInside: this.getItemMetric(aggregations?.itemsPurchasedInside?.value ?? null, "Items purchased inside"),
      itemRevenueInside: this.getItemMetric(aggregations?.itemRevenueInside?.value ?? null, "Items revenue inside")
    };
  };

  formatMetricsTrackingCostSku(aggregations: any) {
    return {
      cost: this.getItemMetric(aggregations?.metricCosts?.value ?? null, "Cost"),
      conversions: this.getItemMetric(aggregations?.metricConversions?.value ?? null, "Conversions"),
      conversionValues: this.getItemMetric(aggregations?.metricConversionValues?.value ?? null, "Conv.value"),
      purchaseInside: this.getItemMetric(aggregations?.purchaseInside?.value ?? null, "Item sold"),
      revenueInside: this.getItemMetric(aggregations?.revenueInside?.value ?? null, "Doanh thu"),
    };
  };

  calculatePercent(valueFirst: any, valueSecond: any) {
    return (valueFirst - valueSecond) / valueSecond * 100;
  };

  createSumAggregation(field: string): object {
    return {
      sum: {
        field
      }
    };
  }

  getMultiTerm(query: any, terms: Terms[]) {
    const termSize = !query.sort ? query.page * query.pageNumber : 40000;
    if (terms.length > 1) {
      const multi_terms: any = {
        multi_terms: {
          terms
        }
      }
      query?.order ? multi_terms.multi_terms.order = JSON.parse(query.order) : multi_terms;
      multi_terms.multi_terms.size = termSize
      return multi_terms;
    } else if (terms.length === 1) {
      const term: any = {
        terms: terms[0]
      }
      query?.order ? term.terms.order = JSON.parse(query.order) : term;
      term.terms.size = termSize;
      return term;
    }
  }

  getMultiTermByItem(terms: Terms[]) {
    if (terms.length > 1) {
      const multi_terms: any = {
        multi_terms: {
          terms
        }
      }
      return multi_terms;
    } else if (terms.length === 1) {
      const term: any = {
        terms: terms[0]
      }
      return term;
    }
  }

  async getSku(query: any): Promise<any> {
    let field: string = getFieldName(query.type);
    let tabSearch: string = field?.split('.')[0];
    const skuQuery = this.getSkuQuery(query, query.startDateFirst, query.endDateFirst, tabSearch);
    const [res] = await Promise.all([
      this.search(this.indexStr, skuQuery)
    ]);
    const data: any[] = [];
    for (const e of res.hits.hits) {
      const item: any = {
        itemId: e._source.itemId,
        date: e._source.date,
        itemName: e._source.itemName,
        channel: e._source.channel,
        deviceCategory: e._source.deviceCategory,
        city: e._source.city,
        sessionSourceMedium: e._source.sessionSourceMedium,
        firstUserCampaignName: e._source.firstUserCampaignName,
        itemCategory: e._source.itemCategory,
        itemCategory2: e._source.itemCategory2,
        itemCategory3: e._source.itemCategory3,
        itemBrand: e._source.itemBrand,
        vendor: e._source.vendor,
        manufacture: e._source.manufacture,
        itemsViewed: e._source.itemsViewed,
        itemsAddedToCart: e._source.itemsAddedToCart,
        itemsCheckedOut: e._source.itemsCheckedOut,
        itemsPurchased: e._source.itemsPurchased,
        itemRevenue: e._source.itemRevenue,
        itemsPurchasedInside: e._source.itemsPurchasedInside,
        itemRevenueInside: e._source.itemRevenueInside,
      }
      data.push(item)
    }
    return {
      data,
      total: res.hits.total
    };
  }

  getSkuQuery(query: any, startDate: string, endDate: string, tabSearch: string): object {
    const q: any = {
      track_total_hits: true,
      query: {
        bool: {
          must: [
            {
              range: {
                date: {
                  gte: startDate,
                  lte: endDate
                }
              }
            }
          ],
          must_not: [
            {
              match: {
                channel: 'Online'
              }
            }
          ]
        }
      },
    };

    if (query.search) {
      const searchQuery: object = {
        bool: {
          should: [
            {
              match: {
                [tabSearch]: {
                  query: query.search,
                  minimum_should_match: "100%"
                }
              }
            }
          ]
        }
      };

      q.query.bool.must.push(searchQuery);
    }

    if (query?.size) {
      q.size = query.size;
    }
    
    if (query?.page) {
      q.from = (query.size * query.page) - query.size;
    }

    if (query?.sort) {
      const sort: Sort[] = query?.sort ? JSON.parse(query.sort) : null;
      q.sort = [ sort ]
    }
    
    return q;
  }

  async getCampaign(query: any): Promise<any> {
    const terms: Terms[] = query?.terms ? JSON.parse(query.terms) : null;
    const sources: any = this.getMultiTerm(query, terms);
    const filter =  query?.filter ? JSON.parse(query.filter) : [];
    const sort =  query?.sort ? JSON.parse(query.sort) : [];

    const exactSearch: boolean = query.exactSearch !== "false";
    let field: string = getFieldNameCampaign(query.type);
    let tabSearch: string = field?.split('.')[0];
    const totalFirstParams = this.totalCampaignQuery(query.search, query.startDateFirst, query.endDateFirst, tabSearch, exactSearch, filter);
    const bodyFirstParams = this.bodyCampaignQuery(query, query.startDateFirst, query.endDateFirst, sources, tabSearch, exactSearch, filter, sort);
    const [totalFirst, bodyFirst] = await Promise.all([
      this.search(this.indexCamp, totalFirstParams),
      this.search(this.indexCamp, bodyFirstParams),
    ]);
    let total: {} = {};
    const body: any[] = [];
    const dates = [`${query.startDateFirst}-${query.endDateFirst}`];
    const totalPage = Math.ceil(bodyFirst?.aggregations?.total_buckets?.value / query.pageNumber);
    total = this.getCampaignTotals(query, totalFirst);
    for (const e of bodyFirst.aggregations.items.buckets) {
      const id: string = e.key.length > 0 ? e.key[0]: "";
      const name: string = e.key.length > 1 ? e.key[1]: "";
      const countTransactions:number = await this.countTransactionIdByCampaignID(id, name);
      const item: any = {
        key: e.key,
        [`${query.startDateFirst}-${query.endDateFirst}`]: {
          advertiserAdCosts: this.getItemMetric(e.advertiserAdCosts?.value, "Advertiser Cost"),
          purchases: this.getItemMetric(e.purchases?.value, "Purchases"),
          totalRevenue: this.getItemMetric(e.totalRevenue?.value, "Total Revenue"),
          coefficient: this.getItemMetric(e.coefficient?.value, "Coefficient"),
          totalTransactions: countTransactions,
          CPO: this.getItemMetric(e.CPO?.value, "CPO"),
          CIR: this.getItemMetric(e.CIR?.value, "CIR")
        }
      };
      body.push(item);
    }
    return {
      dates,
      total,
      body,
      totalPage,
      terms
    };
  }

  async getCampaignDetail(query: any, returnKey?: string): Promise<any> {
    const filter = query?.filter ? JSON.parse(query.filter) : [];
    const sort = query?.sort ? JSON.parse(query.sort) : [];
    const q: any = this.bodyCampaignDetailQuery(
      query,
      query.startDate,
      query.endDate,
      query.campaignId,
      filter,
      sort,
    );
    const [body] = await Promise.all([this.search(this.indexCamp, q)]);
    const totalPage: number = Math.ceil(
      body?.hits?.total?.value / query.pageNumber,
    );
    const countByStatus: any = body?.aggregations?.status_count?.buckets;
    let data: any[] = [];
    for (const e of body.hits.hits) {
      if (returnKey) {
        data = [...data, e._source?.[returnKey]];
      } else {
        const item: any = {
          campaignId: e._source.campaignId,
          campaignName: e._source.campaignName,
          transactionId: e._source.transactionId,
          channel: e._source.channel,
          purchases: e._source.purchases,
          totalRevenue: e._source.totalRevenue,
          status: e._source.status ?? 0,
          insideCreatedDate: e._source.insideCreatedDate ?? 0,
        };

        data = [...data, item];
      }
    }
    return {
      totalPage,
      countByStatus,
      data: data,
    };
  }

  bodyCampaignDetailQuery(query: any, startDate: string, endDate: string, campaignId: string, filter: any, sort: any[]): object {
    const q: any = {
      _source: ["campaignName", "campaignId", "channel", "transactionId", "advertiserAdCost", "purchases", "totalRevenue", "status", "insideCreatedDate"],
      track_total_hits: true,
      query: {
        bool: {
          must: [
            {
              range: {
                date: {
                  gte: startDate,
                  lte: endDate
                }
              },
            },
            {
              term: {
                "campaignId": campaignId
              }
            },
          ],
          must_not: [
            {
              term: {
                transactionId: "",
              }
            }
          ],
          filter: []
        }
      },
      aggs: {
        status_count: {
          terms: {
            field: "status",
            size: 10
          }
        }
      },
      size: query.pageNumber,
      from: (query.pageNumber * query.page) - query.pageNumber
    };

    if (query.transactionId) {
      q.query.bool.must = [...q.query.bool.must].concat({
        term: {
          transactionId: {
            value: query.transactionId,
          }
        }
      });
    }

    if (query.campaignName) {
      q.query.bool.must = [...q.query.bool.must].concat({
        term: {
          campaignName: {
            value: query.campaignName,
          }
        }
      });
    }

    if (filter && filter.length > 0) {
      q.query.bool.filter = filter
    }

    if (sort && sort.length) {
      q.sort = sort
    }

    return q;
  }

  async countTransactionIdByCampaignID(campaignId: string, campaignName: string){
    const q: any = {
      size: 0,
      query: {
        bool: {
          must: [
            { term: { "campaignId": campaignId } },
            { term: { "campaignName": campaignName } }
          ]
        }
      },
      aggs: {
        unique_transactions: {
          cardinality: {
            field: "transactionId"
          }
        }
      }
    }

    const [body] = await Promise.all([
      await this.search(this.indexCamp, q)
    ]);
    return body?.aggregations?.unique_transactions?.value || 0
  }

  totalCampaignQuery(search: string, startDate: string, endDate: string, tabSearch: string, exactSearch: boolean, filter: any): object {
    const q: any = {
      track_total_hits: true,
      query: {
        bool: {
          must: [
            {
              range: {
                date: {
                  gte: startDate,
                  lte: endDate
                }
              }
            }
          ],
          filter: []
        }
      },
      size: 0,
      aggs: {
        advertiserAdCost: this.createSumAggregation("advertiserAdCost"),
        coefficient: this.createSumAggregation("coefficient"),
        purchases: this.createSumAggregation("purchases"),
        totalRevenue: this.createSumAggregation("totalRevenue")
      }
    }
    if (search) {
      let searchQuery:any = {
        bool: {
          should: [
            {
              match: {
                [tabSearch]: {
                  query: search
                }
              }
            }
          ]
        }
      };
    
      if (exactSearch) {
        searchQuery.bool.should[0].match[tabSearch].minimum_should_match = "100%";
      }
    
      q.query.bool.must.push(searchQuery);
    }

    if (filter && filter.length > 0) {
      q.query.bool.filter = filter;
    }
    
    return q;
  }

  bodyCampaignQuery(query: any, startDate: string, endDate: string, sources: any, tabSearch: string, exactSearch: boolean, filter: any, sort: any[]): object {
    const q: any = {
      track_total_hits: true,
      query: {
        bool: {
          must: [
            {
              range: {
                date: {
                  gte: startDate,
                  lte: endDate
                }
              }
            }
          ],
          filter: []
        }
      },
      size: 0,
      aggs: {
        items: {
          aggs: {
            advertiserAdCost: this.createSumAggregation("advertiserAdCost"),
            purchases: this.createSumAggregation("purchases"),
            totalRevenue: this.createSumAggregation("totalRevenue"),
            coefficient: this.createSumAggregation("coefficient"),
            advertiserAdCosts: {
              bucket_script: {
                buckets_path: {
                  advertiserAdCost: "advertiserAdCost",
                  coefficient: "coefficient"
                },
                script: `
                  if (params.coefficient != null && params.coefficient != 0) {
                    return params.advertiserAdCost / params.coefficient;
                  } else {
                    return 0;
                  }
                `
              }
            },
            CPO: {
              bucket_script: {
                buckets_path: {
                  advertiserAdCosts: "advertiserAdCosts",
                  purchases: "purchases"
                },
                script: "params.advertiserAdCosts / params.purchases"
              }
            },
            CIR: {
              bucket_script: {
                buckets_path: {
                  advertiserAdCosts: "advertiserAdCosts",
                  totalRevenue: "totalRevenue"
                },
                script: "params.advertiserAdCosts / params.totalRevenue"
              }
            },
            campaign_bucket_sort: {
              bucket_sort: {
                size: Number(query.pageNumber),
                from: (query.pageNumber * query.page) - query.pageNumber,
              }
            },
            BucketSort: {
              bucket_sort: {
                sort,
                size: Number(query.pageNumber),
                from: (query.pageNumber * query.page) - query.pageNumber
              }
            }
          }
        }
      }
    };

    if (sort.length > 0) {
      delete q.aggs.items.aggs.campaign_bucket_sort;
    } else {
      delete q.aggs.items.aggs.BucketSort;
    }

    let scriptArr :string[] = []

    if (sources?.multi_terms) {
      q.aggs.items = {
        multi_terms: {
          ...sources.multi_terms,
        },
        ...q.aggs.items
      };
      scriptArr = sources?.multi_terms?.terms.map((obj: any) => obj.field);

    } else if (sources?.terms) {
      q.aggs.items = {
        terms: {
          ...sources.terms,
        },
        ...q.aggs.items
      };

      scriptArr = [...scriptArr, sources?.terms?.field];
    }
    if (scriptArr.length > 0) {
      const script = "emit(" + scriptArr.map(elem => `doc['${elem}'].value`).join(' + ') + ")";
      const runtime_mappings = {
        totals: {
          type: "keyword",
          script,
        },
      };
      q.runtime_mappings = runtime_mappings;
      const total_buckets = {
        cardinality: {
          field: "totals",
          precision_threshold: 40000,
        }
      }
      q.aggs.total_buckets = total_buckets
    }

    if (query.search) {
      let searchQuery: any = {
        bool: {
          should: [
            {
              match: {
                [tabSearch]: {
                  query: query.search
                }
              }
            }
          ]
        }
      };
      if (exactSearch) {
        searchQuery.bool.should[0].match[tabSearch].minimum_should_match = "100%";
      }
      q.query.bool.must.push(searchQuery);
    }

    if (filter && filter.length > 0) {
      q.query.bool.filter = filter
    }

    return q;
  }

  async getPriceInfo(query: any): Promise<any> {
    const isBestSeller: boolean = Number(query.isBestSeller) === 1 ? true : Number(query.isBestSeller) === 2 ? false : null;
    const isProblem: number = Number(query.isProblem) || null;
    const sort: Terms[] = query?.sort ? JSON.parse(query.sort) : [];
    const skus: string[] = query?.skus ? JSON.parse(query.skus) : [];
    const skuName: string = query?.skuName ? query?.skuName : '';
    const brand: string[] = query?.brand ? JSON.parse(query.brand) : [];
    const productType: any[] = query?.productType ? JSON.parse(query.productType) : [];
    const page: number = +query.page;
    const pageNumber: number = +query.pageNumber;
    let body: any[] = [];
    let totalPage: number = 0;
    const params: any = {
      skus,
      skuName,
      sort,
      isBestSeller,
      isProblem,
      page,
      pageNumber,
      brand,
      productType
    }
    const priceDataQuery: any = this.getPriceInfoQuery(params);
    const [bodyES] = await Promise.all([
      this.search(this.indexPrice, priceDataQuery),
    ]);
    totalPage = Math.ceil(bodyES?.hits?.total?.value / pageNumber); 
    for (const item of bodyES.hits.hits) {
      const source: any = {...item._source, price_diff: item.fields.price_diff[0]};
      body = [...body, source]
    }
    return {
      body,
      totalPage: totalPage
    }
  }

  getPriceInfoQuery(params: any): object {
    const q: any = {
      _source: true,
      track_total_hits: true,
      size: params.pageNumber,
      from: (params.pageNumber * params.page) - params.pageNumber,
      query: {
        bool: {
          must: []
        }
      },
      sort: [
          {
            _script: {
              script: {
                source:`
                  double hasakiPrice = doc['current_price_hasaki'].value;
                  double lazadaPrice = doc['current_price_lazada'].value != -1 ? doc['current_price_lazada'].value : Double.POSITIVE_INFINITY;
                  double shopeePrice = doc['current_price_shopee'].value != -1 ? doc['current_price_shopee'].value : Double.POSITIVE_INFINITY;
                  double tiktokPrice = doc['current_price_tiktok'].value != -1 ? doc['current_price_tiktok'].value : Double.POSITIVE_INFINITY;
      
                  double lowestPrice = Math.min(Math.min(lazadaPrice, shopeePrice), tiktokPrice);
                  return lowestPrice == Double.POSITIVE_INFINITY ? 0 : lowestPrice - hasakiPrice;
                `
              },
              type: "number",
              order: "asc"
            }
          }
      ],
      script_fields: {
        price_diff: {
          script: {
            source:  `
              double hasakiPrice = doc['current_price_hasaki'].value;
              double lazadaPrice = doc['current_price_lazada'].value != -1 ? doc['current_price_lazada'].value : Double.POSITIVE_INFINITY;
              double shopeePrice = doc['current_price_shopee'].value != -1 ? doc['current_price_shopee'].value : Double.POSITIVE_INFINITY;
              double tiktokPrice = doc['current_price_tiktok'].value != -1 ? doc['current_price_tiktok'].value : Double.POSITIVE_INFINITY;
    
              double lowestPrice = Math.min(Math.min(lazadaPrice, shopeePrice), tiktokPrice);
              return lowestPrice == Double.POSITIVE_INFINITY ? 0 : lowestPrice - hasakiPrice;
            `
          }
        }
      }
    }

    if(params.skus && params.skus.length > 0) {
      q.query.bool.must.push(
        {
          terms: { "sku": params.skus }
        }
      );
    } 

    if(params.skuName && params.skuName.length > 0) {
      q.query.bool.must.push(
        {
          wildcard: { "item_name": {
            value: `*${params.skuName}*`,
            case_insensitive: true
          }}
        }
      );
    } 

    if(params.brand && params.brand.length > 0) {
      q.query.bool.must.push(
        {
          terms: {
            brand: params.brand
          }
        }
      );
    } 

    if(params.productType && params.productType.length > 0) {
      q.query.bool.must.push(
        {
          terms: {
            product_type: params.productType
          }
        }
      );
    } 

    if(params.isBestSeller !== null) {
      q.query.bool.must.push(
        {
          term: { "is_best_seller": params.isBestSeller}
        }
      );
    } 
    

    if(params.isProblem !== null) {
      const strOperate: string = params.isProblem === 1 ? '<' : '>='
      q.query.bool.must.push(
        {
          script: {
            script: {
              source: `
                  double hasakiPrice = doc['current_price_hasaki'].value;
                  double lazadaPrice = doc['current_price_lazada'].value != -1 ? doc['current_price_lazada'].value : Double.POSITIVE_INFINITY;
                  double shopeePrice = doc['current_price_shopee'].value != -1 ? doc['current_price_shopee'].value : Double.POSITIVE_INFINITY;
                  double tiktokPrice = doc['current_price_tiktok'].value != -1 ? doc['current_price_tiktok'].value : Double.POSITIVE_INFINITY;
                  
                  double lowestPrice = Math.min(Math.min(lazadaPrice, shopeePrice), tiktokPrice);
                  return lowestPrice - hasakiPrice ${strOperate} 0;
              `
            }
          }
        }
      );
    } 

    if(params.sort && params.sort.length > 0) {
      q.sort = [...params.sort, ...q.sort];
    } 

    return q;
  }
  
  getCampaignTotals(query: any, totalFirst: any): any {
    return {
      [`${query.startDateFirst}-${query.endDateFirst}`]: {
        advertiserAdCosts: this.getItemMetric(totalFirst?.aggregations?.advertiserAdCost?.value/totalFirst?.aggregations?.coefficient?.value, "Advertiser Cost"),
        purchases: this.getItemMetric(totalFirst?.aggregations?.purchases?.value, "Purchases"),
        totalRevenue: this.getItemMetric(totalFirst?.aggregations?.totalRevenue?.value, "Total Revenue")
      }
    };
  }

  bodyQueryExcel(query: any, startDate: string, endDate: string, sources: [], after: object | null, sort: []): object {

    const q: any = {
      track_total_hits: true,
      query: {
        bool: {
          must: [
            {
              range: {
                date: {
                  gte: startDate,
                  lte: endDate
                }
              }
            }
          ],
          must_not: [
            {
              match: {
                channel: 'Online'
              }
            }
          ]
        }
      },
      size: 0,
      aggs: {
        items: {
          composite: {
            sources,
            size: query?.limit,
          },
          aggs: {
            itemsViewed: this.createSumAggregation("itemsViewed"),
            itemsAddedToCart: this.createSumAggregation("itemsAddedToCart"),
            itemsCheckedOut: this.createSumAggregation("itemsCheckedOut"),
            itemsPurchased: this.createSumAggregation("itemsPurchased"),
            itemRevenue: this.createSumAggregation("itemRevenue"),
            carttoDetailRate: {
              bucket_script: {
                buckets_path: {
                  itemsAddedToCart: "itemsAddedToCart",
                  itemsViewed: "itemsViewed"
                },
                script: "params.itemsAddedToCart / params.itemsViewed * 100"
              }
            },
            buytoDetailRate: {
              bucket_script: {
                buckets_path: {
                  itemsPurchased: "itemsPurchased",
                  itemsViewed: "itemsViewed"
                },
                script: "params.itemsPurchased / params.itemsViewed * 100"
              }
            }
          }
        }
      }
    };

    if (query.search) {
      const searchQuery: object = {
        bool: {
          should: [
            {
              match: {
                itemId: query.search
              }
            },
            {
              match: {
                itemName: {
                  query: query.search,
                  minimum_should_match: "100%"
                }
              }
            }
          ]
        }
      };

      q.query.bool.must.push(searchQuery);
    }

    if (query.filter) {
      const filters = JSON.parse(query.filter);
      const query_string: any = {
        query_string: {
          query: '',
          default_operator: 'AND'
        },
      };
      const filterArr = [];
      const filterKeys = ['sessionSourceMedium', 'firstUserCampaignName', 'channel', 'region', 'city', 'itemId'];
      for (let key of filterKeys) {
        if (key in filters) {
          filters[key] = filters[key].replace(/[.+*?^${}()|[\]\\/]/g, '');
          filterArr.push(`${key}: (*${filters[key]}*)`);
        }
      }
      query_string.query_string.query = filterArr.join(' AND ');
      q.query.bool.must.push(query_string);
    }
    
    if (after) {
      q.aggs.items.composite.after = after;
    }
  
    return q;
  }

  async runAggregationDataExcel(query: any): Promise<any> {
    const sources = query?.sources ? JSON.parse(query.sources) : null
    const sort: [] = query?.sort ? JSON.parse(query.sort) : null
    const after = query?.after ? JSON.parse(query.after) : null
    const isCompare: boolean = query.isCompare !== "false";
    const exactSearch: boolean =  false;
    let field: string = getFieldName(query.type);
    let tabSearch: string = field?.split('.')[0];
    const bodyFirstParams = this.bodyQueryExcel(query, query.startDateFirst, query.endDateFirst, sources, after, sort);
    const bodyFirst = await this.search(this.indexStr, bodyFirstParams)
    const body: any[] = [];
    const dates = [`${query.startDateFirst}-${query.endDateFirst}`, `${query.startDateSecond}-${query.endDateSecond}`];
    const afterKey = bodyFirst?.aggregations?.items?.after_key;
    const ids: string[] = [];
    const idsNegative: string[] = []
    if (!isCompare) {
      let itemId: string = "";
      let totalRevenueBySKU: number = 0;
      for (const e of bodyFirst.aggregations.items.buckets) {
        const item: any = {
          key: e.key,
          [`${query.startDateFirst}-${query.endDateFirst}`]: {
            itemsViewed: this.getItemMetric(e.itemsViewed?.value, "Items viewed"),
            itemsAddedToCart: this.getItemMetric(e.itemsAddedToCart?.value, "Items add to cart"),
            itemsCheckedOut: this.getItemMetric(e.itemsCheckedOut?.value, "Items checkout"),
            itemsPurchased: this.getItemMetric(e.itemsPurchased?.value, "Items purchased"),
            itemRevenue: this.getItemMetric(e.itemRevenue?.value, "Items revenue"),
            carttoDetailRate: this.getItemMetric(e.carttoDetailRate?.value, "Cart to detail rate"),
            buytoDetailRate: this.getItemMetric(e.buytoDetailRate?.value, "Buy to detail rate")
          }
        };
        const hasKey = sources.some((o: any) => 'sessionSourceMedium' in o)
        if (query.type === Define.Type.sku && hasKey) {
          const keys: any = e.key;
          if (itemId != keys.itemId) {
            itemId = keys.itemId;
            const totalParamsBySku = this.totalQuery(itemId, query.startDateFirst, query.endDateFirst, tabSearch, exactSearch, ids, idsNegative, query.filter);
            const [total] = await Promise.all([
              this.search(this.indexStr, totalParamsBySku)
            ]);
            totalRevenueBySKU = total?.aggregations?.itemRevenue?.value;
          }
          let revenueBySkuPercent: number = 0;
          revenueBySkuPercent = (e.itemRevenue?.value / totalRevenueBySKU) * 100;
          item[`${query.startDateFirst}-${query.endDateFirst}`].revenueBySkuPercent = this.getItemMetric(revenueBySkuPercent, "revenue By Sku Percent");
        }
        body.push(item);
      }
    } else {
      for (const e of bodyFirst.aggregations.items.buckets) {
        const obj = Object.entries(e.key).map(([key, value]) => ({
          match: {
            [key]: value
          }
        }));
        const range: {} = {
          range: {
            date: {
              gte: query.startDateSecond,
              lte: query.endDateSecond
            }
          }
        }
        const must = [...obj, range]
        const queryParams = this.bodyQueryByItem(sources, must);
        const itemByKey = await this.search(this.indexStr, queryParams);
        const buckets = itemByKey.aggregations.items.buckets[0];
        const item: any = {
          key: e.key,
          [`${query.startDateFirst}-${query.endDateFirst}`]: this.formatMetrics(e),
          [`${query.startDateSecond}-${query.endDateSecond}`]: this.formatMetrics(buckets),
          'percent': {
            itemsViewed: this.getItemMetric(buckets ? this.calculatePercent(e.itemsViewed.value, buckets.itemsViewed.value) : null, 'Items viewed'),
            itemsAddedToCart: this.getItemMetric(buckets ? this.calculatePercent(e.itemsAddedToCart.value, buckets.itemsAddedToCart.value) : null, 'Items add to cart'),
            itemsCheckedOut: this.getItemMetric(buckets ? this.calculatePercent(e.itemsCheckedOut.value, buckets.itemsCheckedOut.value) : null, 'Items checkout'),
            itemsPurchased: this.getItemMetric(buckets ? this.calculatePercent(e.itemsPurchased.value, buckets.itemsPurchased.value) : null, 'Items purchased'),
            itemRevenue: this.getItemMetric(buckets ? this.calculatePercent(e.itemRevenue.value, buckets.itemRevenue.value) : null, 'Items revenue'),
            carttoDetailRate: this.getItemMetric(buckets ? this.calculatePercent(e.carttoDetailRate.value, buckets.carttoDetailRate.value) : null, 'Cart to detail rate'),
            buytoDetailRate: this.getItemMetric(buckets ? this.calculatePercent(e.buytoDetailRate.value, buckets.buytoDetailRate.value) : null, 'Buy to detail rate'),
          }
        };
        body.push(item);
      }
    }
    return {
      dates,
      body,
      afterKey
    };
  }

  mapDataExcel(body: any, dates: any, type: string) {
    try {
      const mappingKeys: string[] = [
        'itemsViewed',
        'itemsAddedToCart',
        'itemsCheckedOut',
        'itemsPurchased',
        'itemRevenue',
        'carttoDetailRate',
        'buytoDetailRate',
        'revenueBySkuPercent',
        'itemsPurchasedInside',
        'itemRevenueInside',
      ];
      const res: object = {};
      const heading: string[] = [];
      const data: any[] = [];
      if (dates[0] == dates[1]) delete dates[1];
      body.forEach((ele: any) => {
        let value: any[] = [];
        if (
          !heading.includes(
            type == 'channel'
              ? 'Channel'
              : type == 'location'
              ? 'Location'
              : type == 'channel'
              ? 'Channel'
              : type == 'catelv1'
              ? 'Cate Level 1'
              : type == 'catelv2'
              ? 'Cate Level 2'
              : type == 'catelv3'
              ? 'Cate Level 3'
              : type == 'origin'
              ? 'Origin'
              : type == 'vendor'
              ? 'Vendor'
              : type == 'brand'
              ? 'Brand'
              : 'Item Id',
          )
        )
          heading.push(
            type == 'channel'
              ? 'Channel'
              : type == 'location'
              ? 'Location'
              : type == 'channel'
              ? 'Channel'
              : type == 'catelv1'
              ? 'Cate Level 1'
              : type == 'catelv2'
              ? 'Cate Level 2'
              : type == 'catelv3'
              ? 'Cate Level 3'
              : type == 'origin'
              ? 'Origin'
              : type == 'vendor'
              ? 'Vendor'
              : type == 'brand'
              ? 'Brand'
              : 'Item Id',
          );
        value.push(ele['key']['itemId']);
        if (!heading.includes('Name') && type == 'sku') heading.push('Name');
        if (type == 'sku' && heading.includes('Name')) value.push(ele['key']['itemName']);
        if (ele['key']['sessionSourceMedium']) {
          if (!heading.includes('Session source / Medium')) heading.push('Session source / Medium');
          value.push(ele['key']['sessionSourceMedium']);
        }
        if (ele['key']['channel']) {
          if (!heading.includes('Channel')) heading.push('Channel');
          value.push(ele['key']['channel']);
        }
        if (type == 'sku' && !heading.includes('In stock')) heading.push('In stock');
        if (type == 'sku' && !heading.includes('Available Stores')) heading.push('Available Stores');
        if (type == 'sku' && heading.includes('In stock')) value.push(ele['moreInfo']['inStock'] && ele['moreInfo']['inStock'] != '' ? ele['moreInfo']['inStock'] : 0);
        if (type == 'sku' && heading.includes('Available Stores')) value.push(ele['moreInfo']['storeInstock'] && ele['moreInfo']['storeInstock'] != '' ? `${ele['moreInfo']['storeInstock']['shopActive']} / ${ele['moreInfo']['storeInstock']['stockShop']}` : '/');
        mappingKeys.forEach((key: string) => {
          dates.forEach((date: string) => {
            if (key in ele[date]) {
                if (key == 'carttoDetailRate' && !heading.includes('Cart to detail rate (%)')) {
                  heading.push('Cart to detail rate (%)');
                } else if (key == 'buytoDetailRate' && !heading.includes('Buy to detail rate (%)')) {
                  heading.push('Buy to detail rate (%)');
                } else if (key == 'revenueBySkuPercent' && !heading.includes('Revenue by SKU percent (%)')) {
                  heading.push('Revenue by SKU percent (%)');
                }
                if (ele[date][key]['name'] && !heading.includes(ele[date][key]['name']) && !(key == 'carttoDetailRate' || key == 'buytoDetailRate' || key == 'revenueBySkuPercent')) heading.push(ele[date][key]['name']);
              value.push(
                  (key == 'carttoDetailRate' || key == 'buytoDetailRate' || key == 'revenueBySkuPercent') &&
                  ele[date][key]['value'] != null &&
                  ele[date][key]['value'] != 0 &&
                  !Number.isInteger(ele[date][key]['value'])
                  ? ele[date][key]['value'].toFixed(2)
                  : (key == 'carttoDetailRate' || key == 'buytoDetailRate' || key == 'revenueBySkuPercent') &&
                    ele[date][key]['value'] != null &&
                    ele[date][key]['value'] != 0 &&
                    Number.isInteger(ele[date][key]['value'])
                  ? ele[date][key]['value']
                  : ele[date][key]['value'],
              );
            }
          });
        });
        data.push(value);
      });
      res['data'] = data;
      res['heading'] = heading;
      res['total'] = data.length;
      return res;
    } catch (e) {
      console.error(`elastic.service.mapDataExcel:${e.message}`);
      throw new Error(e.message);
    }
  }

  bodyQueryOrderDetail(query: any): object {
    const _source: string[] = [
      'itemId',
      'channel',
      'city',
      'itemCreatedDate',
      'itemCompletedDate',
      'itemBrand',
      'itemCategory',
      'itemCategory2',
      'itemCategory3',
      'itemName',
      'itemRevenueInside',
      'vendor',
      'itemsPurchasedInside',
      'manufacture',
      'itemOrderId',
      'itemProductType',
      'itemInStore',
      'region',
      'itemActiveRule',
      'itemGifts',
      'itemVouchers',
      'itemChannelDetail',
      'itemHasakiPrice',
    ];
    const q: any = {
      track_total_hits: true,
      _source: _source,
      query: {
        bool: {
          must: [
            {
              range: {
                date: {
                  gte: query.startDate,
                  lte: query.endDate,
                }
              }
            }
          ],
          must_not: [
            {
              bool: {
                should: [
                  {
                    match: {channel: "GA4_Web"}
                  },
                  {
                    match: {channel: "GA4_App"}
                  }
                ]
              }
            }
          ]
        }
      },
      size: query.perPage,
      sort: [
        {
          'itemId': {
            order: 'asc',
          },
        },
        {
          'itemOrderId': {
            order: 'asc',
          }
        }
      ]
    };
    return q;
  }

  async runQueryOrderDetail(query: any): Promise<any> {
    try {
      let bodyOrderDetail: any = {}, searchQuery: any, after: any, item: any;
      after = query.search_after != null && query.search_after.length > 0 ? query.search_after : false;
      const bodyQueryOrderDetail = this.bodyQueryOrderDetail(query);
      if (after) bodyQueryOrderDetail['search_after'] = after;
      if (query.filter) {
        const filterKeys = [
          'itemCompletedDate',
          'channel',
          'itemBrand',
          'vendor',
          'itemId',
          'itemOrderId',
          'region',
          'city',
          'itemInStore',
          'itemCreatedDate',
          'itemProductType',
        ];
        const filters = query.filter;
        const filterTerms: any[] = [];
        for (let key of filterKeys) {
          for (let obj of filters) {
            if (key in obj) {
              const filterTerm: any = {
                terms: {},
              };
              for (let term of obj[key]) {
                if (!filterTerm.terms[key]) {
                  filterTerm.terms[key] = [];
                  filterTerm.terms[key].push(term);
                } else {
                  filterTerm.terms[key].push(term);
                }
              }
              filterTerms.push(filterTerm);
            }
          }
        }
        filterTerms.forEach((ele: any) => {
          bodyQueryOrderDetail['query'].bool.must.push(ele);
        });
      }
      //sort
      if (query.order) {
        Object.keys(query.order).forEach((order) => {
          let checkExist = bodyQueryOrderDetail['sort'].some((obj: any) => order in obj);
          if (!checkExist) {
            let sortObj: object = {};
            sortObj[order] = { order: query.order[order] };
            bodyQueryOrderDetail['sort'][0]['itemId'].order = query.order[order]
            bodyQueryOrderDetail['sort'][1]['itemOrderId'].order = query.order[order]
            bodyQueryOrderDetail['sort'].push(sortObj);
          } else {
            for (let obj of bodyQueryOrderDetail['sort']) {
              if (order in obj) {
                bodyQueryOrderDetail['sort'][bodyQueryOrderDetail['sort'].indexOf(obj)][order].order = query.order[order];
                break;
              }
            }
          }
        });
      }
      searchQuery = {index: this.indexStr, body: bodyQueryOrderDetail};
      bodyOrderDetail = await this.elasticsearchService.search(searchQuery);
      const body: any[] = [];
      const totalValue = bodyOrderDetail.hits.total.value;
      const totalPage = totalValue % query.perPage == 0 ? totalValue / query.perPage : Math.floor(totalValue / query.perPage + 1);
      const search_after = bodyOrderDetail.hits.hits.length > 0 ? bodyOrderDetail.hits.hits[bodyOrderDetail.hits.hits.length -1].sort : [];
      bodyOrderDetail.hits.hits.forEach((ele: any) => {
            item = {
              itemCategory3: this.getItemMetric(ele._source.itemCategory3, 'Category level 3'),
              itemCategory2: this.getItemMetric(ele._source.itemCategory2, 'Category level 2'),
              itemCreatedDate: this.getItemMetric(ele._source.itemCreatedDate, 'Created Date'),
              city: this.getItemMetric(ele._source.city, 'City'),
              itemCategory: this.getItemMetric(ele._source.itemCategory, 'Category level 1'),
              channelType: this.getItemMetric(ele._source.channel === 'Offline' ? 'Offline' : 'Online', 'Channel Type'),
              itemOrderId: this.getItemMetric(ele._source.itemOrderId, 'Order Id'),
              itemId: this.getItemMetric(ele._source.itemId, 'SKU'),
              manufacture: this.getItemMetric(ele._source.manufacture, 'Manufacture'),
              itemName: this.getItemMetric(ele._source.itemName, 'Name'),
              itemBrand: this.getItemMetric(ele._source.itemBrand, 'Brand'),
              itemRevenueInside: this.getItemMetric(ele._source.itemRevenueInside, 'Revenue'),
              itemsPurchasedInside: this.getItemMetric(ele._source.itemsPurchasedInside, 'Purchased'),
              itemCompletedDate: this.getItemMetric(ele._source.itemCompletedDate, 'Completed Date'),
              itemProductType: this.getItemMetric(ele._source.itemProductType, 'Product Type'),
              itemInStore: this.getItemMetric(ele._source.itemInStore ?? '', 'Store'),
              region: this.getItemMetric(ele._source.region, 'Region'),
              itemChannelDetail: this.getItemMetric(ele._source.itemChannelDetail, 'Channel'),
        };
        body.push(item);
      });
      return {
        body,
        totalPage,
        totalValue,
        search_after
      };
    } catch (error) {
      console.log(`runQueryOrderDetail : ${error}`);
      throw new Error(`runQueryOrderDetail: ${error}`);
    }
  }

  mapDataOrderDetail(body: any) {
    try {
      const mappingKeys: string[] = [
        'itemId',
        'itemOrderId',
        'itemName',
        'itemChannelDetail',
        'channelType',
        'itemInStore',
        'city',
        'region',
        'itemHasakiPrice',
        'itemCreatedDate',
        'itemCompletedDate',
        'itemBrand',
        'itemProductType',
        'itemCategory',
        'itemCategory2',
        'itemCategory3',
        'itemsPurchasedInside',
        'itemRevenueInside',
        'manufacture',
        'vendor',
        'itemActiveRule',
        'itemGifts',
        'itemVouchers',
      ];
      const res: object = {};
      const heading: any[] = [];
      const data: any[] = [];
      body.forEach((ele: any) => {
        let value: any[] = [];
        mappingKeys.forEach((key: string) => {
          const objToFind = {key, name: ele[`${key}`]['name']}
          const foundObject = heading.find(obj => obj.key === objToFind.key && obj.name === objToFind.name);
          if (!foundObject) {
            heading.push(objToFind);
          }
          value.push({key, value: ele[`${key}`]['value']});
        });
        //
        const inStockObj = {key: 'inStock', name: 'In stock'};
        if (!heading.find(obj => obj.key === inStockObj.key && obj.name === inStockObj.name)) {
          heading.push(inStockObj);
        }
        //
        const availableObj = {key: 'storeInstock', name: 'Available Stores'};
        if (!heading.find(obj => obj.key === availableObj.key && obj.name === availableObj.name)) {
          heading.push(availableObj);
        }
        //
        const minPriceObj = {key: 'minPrice', name: 'Min Price'};
        if (!heading.find(obj => obj.key === minPriceObj.key && obj.name === minPriceObj.name)) {
          heading.push(minPriceObj);
        }
        //
        const minPriceUrlObj = {key: 'minPriceUrls', name: 'Min Price Urls'};
        if (!heading.find(obj => obj.key === minPriceUrlObj.key && obj.name === minPriceUrlObj.name)) {
          heading.push(minPriceUrlObj);
        }
        //
        const stockBelow70Obj = {key: 'stockBelow70', name: 'Store < 70% stock'};
        if (!heading.find(obj => obj.key === stockBelow70Obj.key && obj.name === stockBelow70Obj.name)) {
          heading.push(stockBelow70Obj);
        }
        value.push({key: 'inStock', value: ele['moreInfo']['inStock'] ?? 0});
        const storeInstockValue = `${ele['moreInfo']['storeInstock']['shopActive']} / ${ele['moreInfo']['storeInstock']['stockShop']}`
        value.push({key: 'storeInstock', value: storeInstockValue})
        value.push({key: 'minPrice', value: ele['moreInfo']['minPrice']});
        value.push({key: 'minPriceUrls', value: ele['moreInfo']['minPriceUrls']});
        value.push({key: 'stockBelow70', value: ele['moreInfo']['stockBelow70'] ?? 0});
        data.push(value);
      });
      res['data'] = data;
      res['heading'] = heading;
      return res;
    } catch (error) {
      throw new Error(`mapDataOrderDetail: ${error}`);
    }
  }

  async trackingPerformanceSku(query: any): Promise<any> {
    const terms: Terms[] = query?.terms ? JSON.parse(query.terms) : null;
    const sources: any = this.getMultiTerm(query, terms);
    const filter =  query?.filter ? JSON.parse(query.filter) : [];
    const sourcesByItem: any = this.getMultiTermByItem(terms);

    const isCompare: boolean = query.isCompare !== "false";
    const exactSearch: boolean = query.exactSearch !== "false";
    let field: string = getFieldName(query.type);
    let tabSearch: string = field?.split('.')[0];
    const bodyFirstParams = this.trackingSkuQuery(query, query.startDateFirst, query.endDateFirst, sources, tabSearch, exactSearch, filter);
    const [bodyFirst] = await Promise.all([
      this.search(this.indexStr, bodyFirstParams),
    ]);
    const body: any[] = [];
    const dates = [`${query.startDateFirst}-${query.endDateFirst}`, `${query.startDateSecond}-${query.endDateSecond}`];
    const totalPage = Math.ceil(bodyFirst?.aggregations?.total_buckets?.value / query.pageNumber);

    // Get cost from shopping
    const termsCost:any = [{field:"sku"}];
    const startDateFirstCost: string = convertGADateFormat(query.startDateFirst);
    const endDateFirstCost: string = convertGADateFormat(query.endDateFirst);

    if (!isCompare) {
      for (const e of bodyFirst.aggregations.items.buckets) {
        const item: any = {
          key: e.key,
          [`${query.startDateFirst}-${query.endDateFirst}`]: {
            itemsPurchasedInside: this.getItemMetric(e.itemsPurchasedInside?.value, "Items purchased inside"),
            itemRevenueInside: this.getItemMetric(e.itemRevenueInside?.value, "Items revenue inside"),
          }
        };

        const params:any = {
          pageNumber: 50,
          page: 1
        }
        const sourceCost: any = this.getMultiTerm(params, termsCost);
        const filterCost:any = [{match: {sku: {query: `${e.key}`,minimum_should_match: "100%"}}}];
        const getCostQuery: any = this.trackingCostBySkuQuery(params, startDateFirstCost, endDateFirstCost, sourceCost, filterCost);
        const [costsResult] = await Promise.all([
          this.search(this.indexShoppingPerformance, getCostQuery),
        ]);
        item[`${query.startDateFirst}-${query.endDateFirst}`].metricCosts = this.getItemMetric(costsResult.aggregations.items.buckets[0]?.metricCosts?.value || 0, "cost");
        body.push(item);
      }
    } else {
      for (const e of bodyFirst.aggregations.items.buckets) {
        const keys: [] = Array.isArray(e.key) ? e.key : [e.key];
        const obj = Object.entries(keys).map(([key, value]) => (
          {
            match: {
              [getKeyInTerm(parseInt(key), terms)]: value
            }
          }
        ));
        const range: {} = {
          range: {
            date: {
              gte: query.startDateSecond,
              lte: query.endDateSecond
            }
          }
        }
        const must = [...obj, range]
        const queryParams = this.trackingSkuQueryByItem(sourcesByItem, must);
        const itemByKey = await this.search(this.indexStr, queryParams);
        const buckets = itemByKey.aggregations.items.buckets[0];

        const item: any = {
          key: e.key,
          [`${query.startDateFirst}-${query.endDateFirst}`]: this.formatMetricsTrackingSku(e),
          [`${query.startDateSecond}-${query.endDateSecond}`]: this.formatMetricsTrackingSku(buckets),
          'percent': {
            itemsPurchasedInside: this.getItemMetric(buckets ? this.calculatePercent(e.itemsPurchasedInside.value, buckets.itemsPurchasedInside.value) : null, 'Items purchased inside'),
            itemRevenueInside: this.getItemMetric(buckets ? this.calculatePercent(e.itemRevenueInside.value, buckets.itemRevenueInside.value) : null, 'Items revenue inside')
          }
        };

        const params:any = {
          pageNumber: 50,
          page: 1
        }

        const sourceCost: any = this.getMultiTerm(query, termsCost);
        const filterCost:any = [{match: {sku: {query: `${e.key}`,minimum_should_match: "100%"}}}];
        const getCostFirstQuery: any = this.trackingCostBySkuQuery(params, startDateFirstCost, endDateFirstCost, sourceCost, filterCost);
        // second date
        const startDateSecondCost: string = convertGADateFormat(query.startDateSecond);
        const endDateSecondCost: string = convertGADateFormat(query.endDateSecond);
        const getCostSecondsQuery: any = this.trackingCostBySkuQuery(params, startDateSecondCost, endDateSecondCost, sourceCost, filterCost);
        // execute
        const [costsFirstResult, costsSecondResult] = await Promise.all([
          this.search(this.indexShoppingPerformance, getCostFirstQuery),
          this.search(this.indexShoppingPerformance, getCostSecondsQuery),
        ]);

        const metricFirstCost: any = this.getItemMetric(costsFirstResult.aggregations.items.buckets[0]?.metricCosts?.value || 0, "cost")
        const metricSecondCost: any = this.getItemMetric(costsSecondResult.aggregations.items.buckets[0]?.metricCosts?.value || 0, "cost")
        
        item[`${query.startDateFirst}-${query.endDateFirst}`].metricCosts = metricFirstCost;
        item[`${query.startDateSecond}-${query.endDateSecond}`].metricCosts = metricSecondCost;
        item[`percent`].metricCosts = this.getItemMetric(this.calculatePercent(metricFirstCost.value, metricSecondCost.value), 'Items cost');
        body.push(item);
      }
    }
    return {
      isCompare,
      dates,
      body,
      totalPage,
      terms
    };
  } 
  
  async trackingCostBySku(query: any): Promise<any> {
    const terms: Terms[] = query?.terms ? JSON.parse(query.terms) : null;
    const sources: any = this.getMultiTerm(query, terms);
    const filter =  query?.filter ? JSON.parse(query.filter) : [];
    const sourcesByItem: any = this.getMultiTermByItem(terms);

    const isCompare: boolean = query.isCompare !== "false";

    const bodyFirstParams = this.trackingCostBySkuQuery(query, query.startDateFirst, query.endDateFirst, sources, filter);
    const [bodyFirst] = await Promise.all([
      this.search(this.indexShoppingPerformance, bodyFirstParams),
    ]);
    const body: any[] = [];
    const dates = [`${query.startDateFirst}:${query.endDateFirst}`];
    const totalPage = Math.ceil(bodyFirst?.aggregations?.total_buckets?.value / query.pageNumber);
    if (!isCompare) {
      for (const e of bodyFirst.aggregations.items.buckets) {
        const item: any = {
          key: e.key,
          [`${query.startDateFirst}:${query.endDateFirst}`]: {
            cost: this.getItemMetric(e.metricCosts?.value, "Cost"),
            conversions: this.getItemMetric(e.metricConversions?.value, "Conversions"),
            conversionValues: this.getItemMetric(e.metricConversionValues?.value, "Conv.value"),
            purchaseInside:  this.getItemMetric(e.purchaseInside?.value, "Item sold"),
            revenueInside:  this.getItemMetric(e.revenueInside?.value, "Doanh thu")
          }
        };
        body.push(item);
      }
    } else {
      for (const e of bodyFirst.aggregations.items.buckets) {
        const keys: [] = Array.isArray(e.key) ? e.key : [e.key];
        const obj = Object.entries(keys).map(([key, value]) => (
          {
            match: {
              [getKeyInTerm(parseInt(key), terms)]: value
            }
          }
        ));
        const range: {} = {
          range: {
            date: {
              gte: query.startDateSecond,
              lte: query.endDateSecond
            }
          }
        }
        const must = [...obj, range];
        const queryParams = this.trackingCostSkuQueryByItem(sourcesByItem, must);
        const itemByKey = await this.search(this.indexShoppingPerformance, queryParams);
        const buckets = itemByKey.aggregations.items.buckets[0];
        const item: any = {
          key: e.key,
          [`${query.startDateFirst}:${query.endDateFirst}`]: this.formatMetricsTrackingCostSku(e),
          [`${query.startDateSecond}:${query.endDateSecond}`]: this.formatMetricsTrackingCostSku(buckets),
          'percent': {
            cost: this.getItemMetric(buckets ? this.calculatePercent(e.metricCosts.value, buckets.metricCosts.value) : null, 'Cost'),
            conversions: this.getItemMetric(buckets ? this.calculatePercent(e.metricConversions.value, buckets.metricConversions.value) : null, 'Conversions'),
            conversionValues: this.getItemMetric(buckets ? this.calculatePercent(e.metricConversionValues.value, buckets.metricConversionValues.value) : null, 'Conv.value'),
            purchaseInside: this.getItemMetric(buckets ? this.calculatePercent(e.purchaseInside.value, buckets.purchaseInside.value) : null, 'Item sold'),
            revenueInside: this.getItemMetric(buckets ? this.calculatePercent(e.revenueInside.value, buckets.revenueInside.value) : null, 'Doanh thu')
          }
        };
        body.push(item);
      }
    }

    return {
      isCompare,
      dates,
      body,
      totalPage,
      terms
    };
  }
  
  trackingCostBySkuQuery(query: any, startDate: string, endDate: string, sources: any, filter: any): object {
    const q: any = {
      track_total_hits: true,
      query: {
        bool: {
          must: [
            {
              range: {
                date: {
                  gte: startDate,
                  lte: endDate
                }
              }
            }
          ]
        }
      },
      size: 0,
      aggs: {
        items: {
          aggs: {
            metricClicks: this.createSumAggregation("metric_clicks"),
            metricCosts: this.createSumAggregation("metric_costs"),
            metricConversions: this.createSumAggregation("metric_conversions"),
            metricConversionValues: this.createSumAggregation("metric_conv_values"),
            purchaseInside: this.createSumAggregation("purchase_inside"),
            revenueInside: this.createSumAggregation("revenue_inside"),
            analytics_bucket_sort: {
              bucket_sort: {
                size: Number(query.pageNumber),
                from: (query.pageNumber * query.page) - query.pageNumber,
              }
            }
          }
        }
      }
    };
    let scriptArr :string[] = []

    if (sources?.multi_terms) {
      q.aggs.items = {
        multi_terms: {
          ...sources.multi_terms,
        },
        ...q.aggs.items
      };
      scriptArr = sources?.multi_terms?.terms.map((obj: any) => obj.field);
    } else if (sources?.terms) {
      q.aggs.items = {
        terms: {
          ...sources.terms,
        },
        ...q.aggs.items
      };
      scriptArr = [...scriptArr, sources?.terms?.field];
    }

    if (scriptArr.length > 0) {
      const script = "emit(" + scriptArr.map(elem => `doc['${elem}'].value`).join(' + ') + ")";
      const runtime_mappings = {
        totals: {
          type: "keyword",
          script,
        },
      };
      q.runtime_mappings = runtime_mappings;
      const total_buckets = {
        cardinality: {
          field: "totals",
          precision_threshold: 40000,
        }
      }
      q.aggs.total_buckets = total_buckets
    }

    if (filter && filter.length > 0) {
      q.query.bool.filter = filter
    }

    return q;
  }

  async getPriceFluctuations(sku: any, startTimeStamp: number, endTimeStamp: number, query: any) {
    query.sort = true;
    const terms: Terms[] = query?.terms ? JSON.parse(query.terms) : null;
    const sources: any = this.getMultiTerm(query, terms);
    const q: object = this.priceFluctuationsSkuQuery(sku, startTimeStamp, endTimeStamp, sources);
    const objBySku = await this.search(this.indexStr, q);
    let body: any[] = [];
    objBySku?.aggregations?.items?.buckets.map(async (ele: any) => {
      const keys: [] = Array.isArray(ele?.key) ? ele?.key : [ele?.key];
      const averagePrice = Math.ceil(ele?.itemRevenueInside?.value / ele?.itemsPurchasedInside?.value) || 0;
      let item = {
        keys,
        averagePrice
      };
      body.push(item);
    })
    return body;
  }

  priceFluctuationsSkuQuery(sku: any, startTimeStamp: number, endTimeStamp: number, sources: any): object {
    const q: any = {
      track_total_hits: true,
      query: {
        bool: {
          must: [
            {
              range: {
                orderCreateDate: {
                  gte: startTimeStamp,
                  lte: endTimeStamp
                }
              }
            },
            { 
              match: { 
                itemId: {
                    query: sku,
                    minimum_should_match: "100%"
                } 
              } 
            }
          ],
          must_not: [
            {
              match: {
                channel: 'Online'
              }
            }
          ]
        }
      },
      size: 0,
      aggs: {
        items: {
          aggs: {
            itemsPurchasedInside: this.createSumAggregation("itemsPurchasedInside"),
            itemRevenueInside: this.createSumAggregation("itemRevenueInside")
          }
        }
      }
    };

    if (sources?.multi_terms) {
      q.aggs.items = {
        multi_terms: {
          ...sources.multi_terms,
        },
        ...q.aggs.items
      };
    } else if (sources?.terms) {
      q.aggs.items = {
        terms: {
          ...sources.terms,
        },
        ...q.aggs.items
      };
    }


    return q;
  }

  async runGetFileHistoryByUserId(userId: any, excelPage: string): Promise<any> {
    try {
      const q: any = {
        track_total_hits: true,
        query: {
          bool: {
            must: [
              { match: { "userId": userId } },
              { term: { "excelPage": excelPage } }
            ]
          }
        },
        size: 2000,
        sort: [{ createAt: "desc" }]
      };
      const [body] = await Promise.all([
        await this.search(this.indexHistoryFile, q)
      ]);
      let data :any[] = body.hits.hits.map(el=> {
        return {...el._source}
      });
      return data;
    } catch (error) {
      return [];
    }
  }

  async runGetFileHistoryBySqlQueryString(sqlQueryString: string): Promise<any> {
    try {
      const q: any = {
        track_total_hits: true,
        query: {
          bool: {
            must: [
              { term: { "sqlQueryString": sqlQueryString } },
              { term: { status: statusFileDownload.completed } },
              { term: { status: statusFileDownload.failure } }
            ]
          }
        },
        size: 2000
      };
      const [body] = await Promise.all([
        await this.search(this.indexHistoryFile, q)
      ]);
      let data :any[] = body.hits.hits.map(el=> {
        return {...el._source}
      });
      return data;
    } catch (error) {
      return [];
    }
  }

  async runGetFileHistoryByCondition(queryParams: { userId?: any, sqlQueryString?: string,  status?: number, fileKey?: string}): Promise<any> {
    try {
      const { userId, sqlQueryString, status, fileKey } = queryParams;
      const mustClauses = [];
      if (userId) {
        mustClauses.push({ match: { userId } });
      }
      if (sqlQueryString) {
        mustClauses.push({ term: { "sqlQueryString": sqlQueryString } });
      }
      if (status) {
        mustClauses.push({ term: { status: status } });
      }
      if (fileKey) {
        mustClauses.push({ term: { fileKey } });
      }
      const q: any = {
        track_total_hits: true,
        query: {
          bool: {
            must: mustClauses
          }
        },
        size: 2000,
        sort: [{ createAt: "desc" }]
      };
      const [body] = await Promise.all([
        this.search(this.indexHistoryFile, q)
      ]);
      let data :any[] = body.hits.hits.map(el=> {
        return {...el._source}
      });
      return data;
    } catch (error) {
      console.error(error);
      return [];
    }
  }
  
  async updateDownloadFileES(params: any, status: number): Promise<any> {
    const q: any = {
      script: {
        source: "ctx._source.status = params.newStatus",
        lang: "painless",
        params: {
          newStatus: status // Assuming statusFileDownload.completed is 2
        }
      },
      query: {
        bool: {
          must: [
            { term: { userId: params.userId } },
            { term: { "sqlQueryString": params.sqlQueryString } },
            { term: { createAt: params.createAt } }
          ]
        }
      }
    };
    const result = await this.elasticsearchService.updateByQuery({
      index: this.indexHistoryFile, // replace with your actual index name
      body: q,
      refresh: true // Optional: ensures the update is immediately visible in search results
    });
    return result;
  }

  async updateFailDownloadFile(){
    try {
      const queryParams:  { status: number } = {
        status: statusFileDownload.processing
      }
      const files: any = await this.runGetFileHistoryByCondition(queryParams);
      for (const item of files) {
        await this.updateDownloadFileES(item, statusFileDownload.failure);
        try {
          const pathFile: string = item?.url;
          await fsPromises.access(pathFile);
          cleanupFolders([pathFile])
        } catch (error) {
          continue;
        }
      }
      return "Update file download successful";
    } catch (error) {
      throw new Error(`Oops! update download file went wrong: ${error.message}`);
    }
  }

  async deleteDownloadFileByDay(){
    try {
      const {startTimeStamp, endTimeStamp} = getYesterdayTimestamps();

      const query = {
          query: {
            bool: {
              must: [
                {
                  range: {
                    createAt: {
                      gte: startTimeStamp,
                      lte: endTimeStamp
                    }
                  }
                }
              ]
            }
          }
        }
      const [historyFiles] = await Promise.all([
        this.search(this.indexHistoryFile, query),
      ]);

      const response = await this.elasticsearchService.deleteByQuery({
        index: this.indexHistoryFile,
        body: query
      });
      
      return historyFiles;
    } catch (error) {
      throw new Error(`Oops! update download file went wrong: ${error.message}`);
    }
  }

  async deletePriceInfoByChannel(channel: string): Promise<any> {
    try {
      const response = await this.elasticsearchService.deleteByQuery({
        index: this.indexPrice,
        body: {
          query: {
            match: { "channel": channel }
          }
        }
      });

      console.log(`Deleted documents with channel '${channel}'`);
      return response;
    } catch (error) {
      console.error(`Error deleting documents: ${error}`);
    }
  }

  async findAndUpdateIndexCampaign(data: any) {
    const [res] = await Promise.all([
      this.search(this.indexCamp, {
        query: {
          term: {
            'transactionId': data.transactionId
          }
        }
      })
    ]);

    for (const e of res.hits.hits) {
      await this.elasticsearchService.update({
        id: e._id,
        index: this.indexCamp,
        body: {
          doc: data
        }
      });
    }
  }

  async getAllPriceInfo(){
    let listInFo: any[] = [];
    const body: any = {
      query: {
        match_all: {}
      },
      size: maxPrice
    }
    const result: any = await this.search(this.indexPrice, body);

    for (const e of result.hits.hits) {
      listInFo = [...listInFo, e._source];
    }
    // Trả về dữ liệu
    return listInFo;
  }

  async getShoppingPerformanceById(conditions: any): Promise<any> {
    const { sku, campaign_id} = conditions;
    const mustClauses = [];
    if (sku) {
      mustClauses.push({ match: { sku } });
    }

    if (campaign_id) {
      mustClauses.push({ match: { campaign_id } });
    }
    const q: any = {
      track_total_hits: true,
      query: {
        bool: {
          must: mustClauses
        }
      },
      size: 10000,
      sort: [{ date: "desc" }]
    };
    const [body] = await Promise.all([
      this.search(this.indexShoppingPerformance, q)
    ]);
    let data :any[] = body.hits.hits.map((el: any)=> {
      return {...el._source}
    });
    return data;
  }

  async getCampaignByCondition(params: any): Promise<any>{

    const filter: any[] = []
    if(params?.campaignIds && params?.campaignIds.length > 0){
      filter.push(
        { terms: { campaignId: params?.campaignIds } }
      )
    }

    if(params?.startDate && params?.endDate){
      filter.push(
        { range: { 
          date:{
              gte: params?.startDate,
              lte: params?.endDate,
            } 
          } 
        }
      )
    }
    const q: any = {
      track_total_hits: true,
      query: {
        bool: {
          filter
        }
      },
      size: 10000
    };
    const [body] = await Promise.all([
      this.search(this.indexCamp, q)
    ]);
    let data :any[] = [];
    for (const item of body.hits.hits) {
      data.push({...item._source})
    }
    return data;
  }

  async getAnalyticsByCondition(params: any): Promise<any>{

    const filter: any[] = []
    if(params?.channels && params?.channels.length > 0){
      filter.push(
        { terms: { channel: params?.channels } },
      )
    }
  
    if(params?.itemOrderIds && params?.itemOrderIds.length > 0){
      filter.push(
        { terms: { itemOrderId: params?.itemOrderIds } },
      )
    }

    if(params?.channelFlags && params?.channelFlags.length > 0){
      filter.push(
        { terms: { channelFlag: params?.channelFlags } },
      )
    }

    if(params?.itemIds && params?.itemIds.length > 0){
      filter.push(
        { terms: { itemId: params?.itemIds } },
      )
    }
  
    const q: any = {
      track_total_hits: true,
      query: {
        bool: {
          filter
        }
      },
      size: 10000
    };
    const [body] = await Promise.all([
      this.search(this.indexStr, q)
    ]);
    let data :any[] = [];
    for (const item of body.hits.hits) {
      data.push({...item._source})
    }
    return data;
  }
}