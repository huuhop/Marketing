import { Injectable, HttpException, HttpStatus, Res } from '@nestjs/common';
import { BaseService } from 'src/services/base.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Products } from 'src/entities/products.entity';
import { Between, In, Repository } from 'typeorm';
import { ProductStocks } from 'src/entities/product_stocks.entity';
import {
  paginate,
  Pagination,
  IPaginationOptions,
} from 'nestjs-typeorm-paginate';
import { GoogleAnalyticsService } from 'src/services/google-analytics.service';
import { GoogleAnalyticsAppService } from 'src/services/google-analytics-app.service';
import { ElasticService } from '../elastic/elastic.service';
import { ProductBrands } from 'src/entities/product_brands.entity';
import { RedisService } from 'src/services/redis.service';
import { Cache, Define, OrderStatus, OrderTracking } from 'src/common';
import { Stocks } from 'src/entities/stocks.entity';
import { Skus } from 'src/entities/skus.entity';
import { InsideService } from 'src/services/inside.service';
import { CityInside } from 'src/entities/city_inside.entity';
import { OffLineReciptService } from 'src/services/offline-receipt.service';
import { ReceiptDetails } from 'src/entities/receipt_details.entity';
import { checkIdInArrayExists, checkPromotion, chunkAndExecPromiseAll, chunkArray, cleanupFolders, convertGADateFormat, convertNumberArrayToStringArray, convertVendorAndCompanyName, createPlatformData, createTemporaryFile, findLowestPriceForId, generateUniqueString, getDateFormat, getIndexOfObject, getObjectBySku, getObjectExcel, getTimestamp, getTimestampGTM7FromStr, mergeArrays, sleep } from 'src/utilities/helper';
import { EcommerceService } from 'src/services/ecommerce-service.service';
import { ShopeeService } from 'src/services/shopee.service';
import { channel, channelFlag, checkPriceMetrics, pageFileName, productType, statusFileDownload, typePromotionTiktok } from 'src/common/commom';
import { LazadaService } from 'src/services/lazada.service';
import { GoogleApiService } from 'src/services/googleapi.service';
import { Response } from 'express';
import { ExcelService } from 'src/services/excel.service';
import { ZipService } from 'src/services/zip.service';
import * as fs from 'fs';
import { TiktokService } from 'src/services/tiktok.service';
import * as crypto from 'crypto-js';
import { Orders } from 'src/entities/orders.entity';
import { v4 as uuidv4 } from 'uuid';
import { QueueService } from '../queue/queue.service';
import { MinIOService } from 'src/services/minIO.service';
import { ExportExcelJobDataDto } from 'src/modules/analytics/dto/export-excel-job-data-dto';
import moment from 'moment';
import { checkPriceHeaderExcel } from 'src/common/excel';
import { OrdersBackup } from 'src/entities/orders_backup.entity';
import { CampaignDetailDto, CampaignDetailOrderStatusDto } from 'src/modules/analytics/dto/campaign-detail-dto';

@Injectable()
export class AnalyticsService extends BaseService {
  protected bucketIO: string = process.env.MINIO_BUCKET;
  protected endPoindIO: string = process.env.MINIO_ENDPOINT;
  constructor(
    @InjectRepository(Products) private productRepository: Repository<Products>,
    @InjectRepository(ProductStocks) private productStocksRepository: Repository<ProductStocks>,
    @InjectRepository(ProductBrands) private ProductBrandsRepository: Repository<ProductBrands>,
    @InjectRepository(Stocks) private StocksRepository: Repository<Stocks>,
    @InjectRepository(Skus) private SkusRepository: Repository<Skus>,
    @InjectRepository(CityInside) private cityInsideRepository: Repository<CityInside>,
    @InjectRepository(ReceiptDetails) private receiptDetailsRepository: Repository<ReceiptDetails>,
    @InjectRepository(Orders) private orderRepository: Repository<Orders>,
    @InjectRepository(OrdersBackup) private ordersBackupRepository: Repository<OrdersBackup>,
    private googleAnalyticsService: GoogleAnalyticsService,
    private googleAnalyticsAppService: GoogleAnalyticsAppService,
    private offlineReciptService: OffLineReciptService,

    private insideService: InsideService,
    private elasticService: ElasticService,
    private redisService: RedisService,
    private ecomerceService: EcommerceService,
    private shopeeService: ShopeeService,
    private lazadaService: LazadaService,
    private tiktokService: TiktokService,
    private googleApiService: GoogleApiService,
    private queueService: QueueService,
    private excelService: ExcelService,
    private zipService: ZipService,
    private minioService: MinIOService
  ) {
    super();
  }

  async getToken(){
    const tokenShopee: any = await this.shopeeService.getToken();
    const tokenLazada: any = await this.lazadaService.getToken();
    const tokenTiktok: any = await this.tiktokService.getToken();
    return {
      tokenShopee,
      tokenLazada,
      tokenTiktok
    }
  }

  async hello(options: IPaginationOptions) {
    return ("Welcome guys :))");
  }

  // Function to generate unique key
  generateUniqueKey(index: string): string {
    let r = (Math.random() + 1000000).toString(36).substring(8);
    return index + r;
  }

  // Function to generate unique key
  generateUniqueKeyWithTimestamp(): string {
    const uniqueKey = uuidv4();
    return uniqueKey;
  }

  async indexDataToElastic(data: any[], stringNumber: string): Promise<void> {
    await this.elasticService.bulkIndexAnalytics({
      data,
      chunkSize: 3000,
      getIdCallback(dataItem, rowIndexed) {
        return stringNumber + '-' + dataItem.channel + '-' + rowIndexed;
      },
    });
  }

  async deleteDataElastic(data: any[]): Promise<void> {
    const promiseList = data.map(async (item: any, i: number) => {
      const query = {
        bool: {
          must: [
            { match: { itemOrderId: item.itemOrderId } },
            { match: { channelFlag: item.channelFlag } },
            { match: { channel: item.channel } }
          ]
        }
      }
      await this.elasticService.deleteBy(query);
    });

    await Promise.all(promiseList);
  }

  async indexCampaignToElastic(data: any[], stringNumber: string): Promise<void> {
    const orders = await this.orderRepository.find({
      select: {
        order_status: true,
        order_code: true,
        order_cdate: true
      },
    });

    await this.elasticService.bulkIndexCampaign({
      data,
      chunkSize: 3000,
      getIdCallback(dataItem, rowIndexed) {
        return stringNumber + '-' + dataItem.channel + '-' + rowIndexed;
      },
      derivedDataItemCallback(dataItem) {
        if (dataItem.transactionId !== '(not set)') {
          const order = orders.find(
            (item: any) => item.order_code == dataItem.transactionId,
          );
          if (order?.order_cdate) {
            dataItem.insideCreatedDate = order.order_cdate;
          }
        }
        return dataItem;
      },
    });
  }

  async indexShoppingPerformanceToElastic(data: any[]): Promise<void> {
    console.log('Index Shopping Performace View To Elastic:');
    await this.elasticService.bulkIndexShoppingPerformace({
      data,
      chunkSize: 1000,
      getIdCallback: (dataItem, rowIndexed) => {
        const random: string = this.generateUniqueKey(rowIndexed.toString());
        return dataItem?.sku + '-' + dataItem?.campaign_id + '-' + random;
      },
    });
    return;
  }


  async syncCampaignToElastic(data: any[]): Promise<void> {
    if (data.length === 0) {
      return;
    }
    const promiseList = data.map(async (e: any) => {
      await this.elasticService.findAndUpdateIndexCampaign(e);
    });

    await Promise.all(promiseList);
  }

  async indexPriceInfoToElastic(data: any[], channel: string): Promise<void> {
    console.log('Index Price Info To Elastic Channel:', channel);
    await this.elasticService.bulkIndexPriceInfo({
      data,
      chunkSize: 3000,
      getIdCallback: (dataItem, rowIndexed) => {
        const random: string = this.generateUniqueKey(rowIndexed.toString());
        return dataItem?.sku + '-' + random;
      },
    });
    return;
  }

  async indexPriceHistoryInfoToElastic(data: any[]): Promise<void> {
    await this.elasticService.bulkIndexPriceHistoryInfo({
      data,
      chunkSize: 3000,
      getIdCallback: (dataItem, rowIndexed) => {
        const random: string = this.generateUniqueKey(rowIndexed.toString());
        return dataItem?.sku + '-' + random;
      },
      derivedDataItemCallback(dataItem) {
        dataItem.createAt = getTimestamp();
        return dataItem;
      },
    });
    return;
  }

  async handleApiGA4(query: any) {
    try {
      const products = await this.productRepository.find({
        relations: ['productBrand', 'vendorMaketing'],
        select: {
          id: true,
          sku: true,
          name: true,
          brand: true,
          categories: true,
          country_of_manufacture: true,
          hsk_price: true,
        },
      });
      const { data, startDate, endDate } = await this.googleAnalyticsService.handleApiGA4(query, products, channelFlag.gaWeb);

      const date = new Date(startDate);
      const stringNumber = date.getTime().toString() + "GA4";
      await this.indexDataToElastic(data, stringNumber);
      return data;
    } catch (err) {
      console.log('handleApiGA4 err', err);
      console.log(err.message);
      throw err;
    }
  }

  async handleApiGA4Campaign(query: any) {
    try {
      const { data, startDate, endDate } = await this.googleAnalyticsService.handleCampain(query);

      const date = new Date(startDate);
      const stringNumber = date.getTime().toString() + "GA4";
      await this.indexCampaignToElastic(data, stringNumber);
      return data;
    } catch (err) {
      console.log('handleApiGA4 Campaign Error', err);
      return null;
    }
  }

  async handleApiGAApp(query: any) {
    try {
      const products = await this.productRepository.find({
        relations: ['productBrand', 'vendorMaketing'],
        select: {
          id: true,
          sku: true,
          name: true,
          brand: true,
          categories: true,
          country_of_manufacture: true,
          product_type: true,
          hsk_price: true,
        },
      });
      const { data, startDate, endDate } = await this.googleAnalyticsAppService.handleApiGAApp(query, products, channelFlag.gaApp);

      const date = new Date(startDate);
      const stringNumber = date.getTime().toString() + "GAApp";

      await this.indexDataToElastic(data, stringNumber);
      return data;
    } catch (err) {
      console.log('handleApiGA4 App err', err);
      console.log(err.message);
      throw err;
    }
  }

  async handleApiGAAppCampaign(query: any) {
    try {
      const { data, startDate, endDate } = await this.googleAnalyticsAppService.handleCampain(query);

      const date = new Date(startDate);
      const stringNumber = date.getTime().toString() + "GAApp";

      await this.indexCampaignToElastic(data, stringNumber);
      return data;
    } catch (err) {
      console.log('handleApiGA4 App err', err);
      return null;
    }
  }

  async handleOfflineReceipt(query: any) {
    try {
      const receiptDetails = await this.getReceiptDetails(query.startDateFirst);
      const products = await this.productRepository.find({
        relations: ['productBrand', 'vendorMaketing'],
        select: {
          id: true,
          sku: true,
          name: true,
          brand: true,
          categories: true,
          country_of_manufacture: true,
          product_type: true,
          hsk_price: true,
        },
      });
      const listCache = await this.redisService.get(
        `${process.env.APP_ENV}${Cache.HSKNOW_GROUP_LIST_CACHE_KEY}`
      );
      const cities = await this.cityInsideRepository.find();
      const { data, startDate, endDate } = await this.offlineReciptService.handleOfflineReceipt(query, receiptDetails, products, cities, "Offline", listCache, channelFlag.offline);
      const date = new Date(startDate);
      const stringNumber = date.getTime().toString() + "Offline";
      await this.indexDataToElastic(data, stringNumber);
    } catch (err) {
      console.log('handleApiOffLine err', err);
      console.log(err.message);
      throw err;
    }
  }

  async handleApiInsideOrder(query: any) {
    try {
      let dataGA4filter: any
      const q: any = {
        offset: query?.offset ?? 0,
        with_details: query?.with_details ?? 1,
        limit: query?.limit ?? 1000,
        from_cdate: query?.startDateFirst,
        to_cdate: query?.endDateFirst
      }

      const products = await this.productRepository.find({
        relations: ['productBrand', 'vendorMaketing'],
        select: {
          id: true,
          sku: true,
          name: true,
          brand: true,
          categories: true,
          country_of_manufacture: true,
          product_type: true,
          hsk_price: true,
        },
      });
      
      const dimension = [
        {
          name: 'itemId',
        },
        {
          name: 'sessionSourceMedium',
        },
        {
          name: 'transactionId',
        },
      ];
      const queryGA4 = {
        startDate: query?.startDateFirst,
        endDate: query?.endDateFirst,
      };
      const dataGA4 = await this.googleAnalyticsService.getDataGA4(
        queryGA4,
        dimension,
      );
      dataGA4filter = dataGA4.rows.filter((obj: any) => obj.dimensionValues[2].value !== '(not set)');
      dataGA4filter.map((ele: any) => delete ele.metricValues);
      const cities = await this.cityInsideRepository.find();
      const date = new Date(q?.from_cdate);
      const stringNumber = date.getTime().toString() + "Inside";

      // const dataShopee = await this.insideService.getInsideOrder(q, 0, products, cities, OrderTracking.SHOPEE, channel.shopee, dataGA4filter, channelFlag.inside);
      // // await this.syncCampaignToElastic(dataShopee.campaign);
      // await this.indexDataToElastic(dataShopee.data, stringNumber);
      // const dataTikTok = await this.insideService.getInsideOrder(q, 0, products, cities, OrderTracking.TIKTOK, channel.tiktok, dataGA4filter, channelFlag.inside);
      // // await this.syncCampaignToElastic(dataTikTok.campaign);
      // await this.indexDataToElastic(dataTikTok.data, stringNumber);
      // const dataLazada = await this.insideService.getInsideOrder(q, 0, products, cities, OrderTracking.LAZADA, channel.lazada, dataGA4filter, channelFlag.inside);
      // // await this.syncCampaignToElastic(dataLazada.campaign);
      // await this.indexDataToElastic(dataLazada.data, stringNumber);
      const dataWeb = await this.insideService.getInsidePlatformOrder(q, 0, products, cities, OrderTracking.WEB, channel.ga4web, channelFlag.inside);
      // await this.syncCampaignToElastic(dataWeb.campaign);
      await this.indexDataToElastic(dataWeb.data, stringNumber);
      const dataApp = await this.insideService.getInsidePlatformOrder(q, 0, products, cities, OrderTracking.APP, channel.ga4app, channelFlag.inside);
      // await this.syncCampaignToElastic(dataApp.campaign);
      await this.indexDataToElastic(dataApp.data, stringNumber);


      // Online
      const dataHasaki = await this.insideService.getInsideOrder(q, 0, products, cities, OrderTracking.HASAKI, channel.online, dataGA4filter, channelFlag.online);
      // await this.syncCampaignToElastic(dataHasaki.campaign);
      await this.indexDataToElastic(dataHasaki.data, stringNumber);
      const dataPickUp = await this.insideService.getInsideOrder(q, 0, products, cities, OrderTracking.PICK_UP, channel.online, dataGA4filter, channelFlag.online);
      // await this.syncCampaignToElastic(dataPickUp.campaign);
      await this.indexDataToElastic(dataPickUp.data, stringNumber);
      const dataViettelPost = await this.insideService.getInsideOrder(q, 0, products, cities, OrderTracking.VIETTEL_POST, channel.online, dataGA4filter, channelFlag.online);
      // await this.syncCampaignToElastic(dataViettelPost.campaign);
      await this.indexDataToElastic(dataViettelPost.data, stringNumber);
      const dataGHN = await this.insideService.getInsideOrder(q, 0, products, cities, OrderTracking.GIAO_HANG_NHANH, channel.online, dataGA4filter, channelFlag.online);
      // await this.syncCampaignToElastic(dataGHN.campaign);
      await this.indexDataToElastic(dataGHN.data, stringNumber);
      const dataHSKNow = await this.insideService.getInsideOrder(q, 0, products, cities, OrderTracking.HASAKI_NOW, channel.online, dataGA4filter, channelFlag.online);
      // await this.syncCampaignToElastic(dataHSKNow.campaign);
      await this.indexDataToElastic(dataHSKNow.data, stringNumber);
      const dataSPX = await this.insideService.getInsideOrder(q, 0, products, cities, OrderTracking.SHOPEE_EXPRESS, channel.online, dataGA4filter, channelFlag.online);
      // await this.syncCampaignToElastic(dataSPX.campaign);
      await this.indexDataToElastic(dataSPX.data, stringNumber);
      const dataNTL = await this.insideService.getInsideOrder(q, 0, products, cities, OrderTracking.NHAT_TIN_LOGISTICS, channel.online, dataGA4filter, channelFlag.online);
      // await this.syncCampaignToElastic(dataNTL.campaign);
      await this.indexDataToElastic(dataNTL.data, stringNumber);
      return "";
    } catch (err) {
      console.log('handleInsideOrder err', err);
      console.log(err.message);
      throw err;
    }
  }

  async handleApiInsideOrderCancel(query: any) {
    try {
      const q: any = {
        offset: query?.offset ?? 0,
        with_details: query?.with_details ?? 1,
        limit: query?.limit ?? 1000,
        from_completed_date: query?.startDateFirst,
        to_completed_date: query?.endDateFirst
      }

      const dataShopee = await this.insideService.getInsideOrderCancel(q, 0, OrderTracking.SHOPEE, channel.shopee, channelFlag.inside);
      await this.deleteDataElastic(dataShopee.data);
      const dataTikTok = await this.insideService.getInsideOrderCancel(q, 0, OrderTracking.TIKTOK, channel.tiktok, channelFlag.inside);
      await this.deleteDataElastic(dataTikTok.data);
      const dataLazada = await this.insideService.getInsideOrderCancel(q, 0, OrderTracking.LAZADA, channel.lazada, channelFlag.inside);
      await this.deleteDataElastic(dataLazada.data);
      const dataWeb = await this.insideService.getInsidePlatformOrderCancel(q, 0, OrderTracking.WEB, channel.ga4web, channelFlag.inside);
      await this.deleteDataElastic(dataWeb.data);
      const dataApp = await this.insideService.getInsidePlatformOrderCancel(q, 0, OrderTracking.APP, channel.ga4app, channelFlag.inside);
      await this.deleteDataElastic(dataApp.data);

      return '';
    } catch (err) {
      console.log('handleInsideOrder err', err);
      console.log(err.message);
      throw err;
    }
  }

  async handleShoppingPerformance(query: any) {
    try {
      const { data, date } = await this.googleApiService.getShoppingPerformanceView(query);
      await this.indexShoppingPerformanceToElastic(data);
      return data;
    } catch (err) {
      console.log('handleShoppingPerformance err', err);
      console.log(err.message);
      throw err;
    }
  }

  async runAggregation(query: any) {
    try {
      const isBestSeller: number = Number(query.isBestSeller);
      const isSkuAvailable: number = Number(query.isSkuAvailable);
      const isProductNew: number = Number(query.isProductNew);
      let ids: string[] = [];
      let idsNegative: string[] = [];
      if (isBestSeller === 1) {
        let bestSeller: any = await this.getBestSeller();
        bestSeller.forEach((ele: any) => {
          ids.push(ele.sku);
          ids = Array.from(new Set(ids));
        })
      } else if (isBestSeller === 2) {
        let bestSeller: any = await this.getBestSeller();
        bestSeller.forEach((ele: any) => {
          idsNegative.push(ele.sku);
          idsNegative = Array.from(new Set(idsNegative));
        })
      }

      if (isSkuAvailable === 1) {
        let skuAvailables: any = await this.getSkuInProductStockTotalAvailable();
        skuAvailables.forEach((ele: any) => {
          ids.push(ele.sku);
          ids = Array.from(new Set(ids));
        })
      } else if (isSkuAvailable === 2) {
        let skuAvailables: any = await this.getSkuInProductStockTotalAvailable();
        skuAvailables.forEach((ele: any) => {
          idsNegative.push(ele.sku);
          idsNegative = Array.from(new Set(idsNegative));
        })
      }

      if (isProductNew === 1) {
        let skuProducts: any = await this.ecomerceService.getEcommerceProductNews();
        skuProducts.forEach((ele: any) => {
          ids.push(ele.sku);
          ids = Array.from(new Set(ids));
        })
      } else if (isSkuAvailable === 2) {
        let skuProducts: any = await this.ecomerceService.getEcommerceProductNews();
        skuProducts.forEach((ele: any) => {
          idsNegative.push(ele.sku);
          idsNegative = Array.from(new Set(idsNegative));
        })
      }
      const { isCompare, dates, total, body, totalPage, terms } = await this.elasticService.runAggregation(query, ids, idsNegative); 
      const products = await this.productRepository.find({
        select: {
          id: true,
          sku: true,
          name: true
        },
      });

      const availableStores: any[] = await this.ecomerceService.getEcommerceAvailableStores();
      const stockIds: any[] = availableStores.map(item => item.stock_id);
      await Promise.all(
        body.map(async (item: any) => {
          const keys: [] = Array.isArray(item?.key) ? item?.key : [item?.key];
          const index = getIndexOfObject(terms, "itemId");
          if (index >= 0 && keys[index]) {
            const inStock: any = await this.getInStockInProductStocks(keys[index]);
            const storeInstock = await this.getStoreInStock(keys[index], stockIds);
            const objBySku = getObjectBySku(keys[index], products, 'sku');
            return item.moreInfo = { inStock: inStock?.in_stock, storeInstock, skuName: objBySku?.name };
          }
        })
      );
      return { isCompare, dates, total, body, totalPage };
    } catch (e) {
      console.log("Run Aggregation err");
      console.log(e.message);
      return e.message;
    }
  }

  async getCampaign(query: any) {
    try {
      const { dates, total, body, totalPage, terms } = await this.elasticService.getCampaign(query);
      return { dates, total, body, totalPage };
    } catch (e) {
      console.log("Get Campaign err");
      console.log(e.message);
      throw e;
    }
  }

  async getCampaignDetail(query: CampaignDetailDto) {
    try {
      const { totalPage, countByStatus, data } =
        await this.elasticService.getCampaignDetail(query);

      const orderCodes = data.map((dataItem: any) => dataItem?.transactionId);

      const orderQuery = {
        select: {
          order_status: true,
          order_code: true,
          order_cdate: true,
          order_subtotal: true,
        },
        where: {
          order_code: In([...orderCodes]),
        },
      };

      const orders = await this.orderRepository.find(orderQuery);
      const ordersBackup = await this.ordersBackupRepository.find(orderQuery);
      const foundOrders = [...orders, ...ordersBackup];

      const derivedData = data.map((e: any) => {
        const cloneEl = { ...e };
        if (cloneEl.transactionId !== '(not set)') {
          const order = foundOrders.find(
            (item: any) => item.order_code == e.transactionId,
          );
          cloneEl.status = order?.order_status ?? e.status;
          cloneEl.insideCreatedDate = order?.order_cdate ?? e.insideCreatedDate;
          cloneEl.totalRevenue = order?.order_subtotal ?? e.totalRevenue;
          cloneEl.source = {
            gaSource: e,
            insideOrderSource: order ?? null,
          };
        }
        return cloneEl;
      });

      return { totalPage, countByStatus, data: derivedData };
    } catch (e) {
      console.log('Get Campaign err');
      console.log(e.message);
      throw e;
    }
  }

  async getCampaignDetailOrderStatusV2(query: CampaignDetailOrderStatusDto) {
    const { data, totalPage } = await this.elasticService.getCampaignDetail(
      {
        ...query,
        page: '1',
        pageNumber: '10000',
      },
      'transactionId',
    );

    let whereInChunkDatas = chunkArray(data, 200);

    let completedStatus = 0;
    let cancelStatus = 0;
    let otherStatus = 0;

    await chunkAndExecPromiseAll({
      chunkSize: 5,
      array: whereInChunkDatas.map(async (chunkItem) => {
        let orderQuery = {
          select: {
            order_status: true,
          },
          where: {
            order_code: In(chunkItem),
          },
        };

        const orders = await this.orderRepository.find(orderQuery);
        const ordersBackup = await this.ordersBackupRepository.find(orderQuery);

        const ordersStatusCallback = (order) => {
          switch (order.order_status) {
            case OrderTracking.STATUS_COMPLETED: {
              completedStatus++;
              break;
            }
            case OrderTracking.STATUS_CANCEL: {
              cancelStatus++;
              break;
            }
            default: {
              otherStatus++;
              break;
            }
          }
        };

        orders.forEach(ordersStatusCallback);
        ordersBackup.forEach(ordersStatusCallback);

        return Promise.resolve(1);
      }),
    });

    return {
      completedStatus,
      cancelStatus,
      processingStatus: 0,
      otherStatus,
    };
  }

  async getCampaignDetailOrderStatus(query: CampaignDetailOrderStatusDto) {
    const formatStartDay = convertGADateFormat(query.startDate);
    const formatEndDay = convertGADateFormat(query.endDate);
    const startOfDay = getTimestampGTM7FromStr(`${formatStartDay} 00:00:00`);
    const endOfDay = getTimestampGTM7FromStr(`${formatEndDay} 23:59:59`);

    console.log({startOfDay, endOfDay, formatStartDay, formatEndDay})

    const ordersQuery = {
      select: {
        order_code: true,
        order_status: true,
      },
      where: {
        order_cdate: Between(startOfDay, endOfDay),
        order_code:
          query.transactionId && query.transactionId.length > 0
            ? query.transactionId
            : undefined,
        order_status: In([
          OrderTracking.STATUS_COMPLETED,
          OrderTracking.STATUS_CANCEL,
        ]),
      },
    };

    const orders = await this.orderRepository.find(ordersQuery);
    const ordersBackup = await this.ordersBackupRepository.find(ordersQuery);

    const foundOrders = [...orders, ...ordersBackup];
    const ordersObject = foundOrders.reduce((obj, order) => {
      obj[order.order_code] = order.order_status;
      return obj;
    }, {});

    const { data } = await this.elasticService.getCampaignDetail({
      ...query,
      page: 1,
      pageNumber: 10000,
    });
    let completedStatus = 0;
    let cancelStatus = 0;

    data.forEach((dataItem) => {
      const status = ordersObject[dataItem.transactionId];
      switch (status) {
        case OrderTracking.STATUS_COMPLETED: {
          completedStatus++;
          break;
        }
        case OrderTracking.STATUS_CANCEL: {
          cancelStatus++;
          break;
        }
        default: {
          break;
        }
      }
    });

    return {
      completedStatus,
      cancelStatus,
      processingStatus: 0,
      otherStatus: data.length - completedStatus - cancelStatus,
    };
  }

  async exportExcelCampaignDetail(data: ExportExcelJobDataDto) {
    await this.excelService.splitAndCreateFileZipExcel({
      data,
      keyAndHeadingMapping: [
        { key: 'transactionId', name: 'Mã đơn hàng' },
        { key: 'totalRevenue', name: 'Revenue' },
        { key: 'status', name: 'Trạng thái' },
        { key: 'insideCreatedDate', name: 'Thời gian tạo' },
      ],
      getExcelDataFunc: async ({ metadata, page }) => {
        const res = await this.getCampaignDetail({
          ...metadata.filters,
          pageNumber: 50,
          page,
        });
        return {
          data: res.data.map((item) => {
            return [
              { key: 'transactionId', value: item.transactionId },
              { key: 'totalRevenue', value: item.totalRevenue },
              { key: 'status', value: OrderStatus?.[+item.status] ?? 'N/A' },
              { key: 'insideCreatedDate', value: item.insideCreatedDate === 0 ? 'N/A': moment.unix(item.insideCreatedDate).format("DD-MM-YYYY") },
            ];
          }),
        };
      },
    });
  }

  async runDetailBySku(query: any) {
    try {
      const { sku } = query;
      const [products, stockBelow70]: [any, number] = await Promise.all([
        this.getProductDetailsBySku(sku),
        this.getStockBelow70Count(sku)
      ]);
      products.stockBelow70 = stockBelow70;

      return {
        products
      };
    } catch (err) {
      console.log('runDetailBySku By Sku Err', err.message);
      throw new Error(`Oops! Something went wrong: ${err.message}`);
    }
  }

  async getPriceFluctuationsSku(query: any) {
    try {
      const priceFluctuations = await this.getPriceFluctuations(query);
      return {
        priceFluctuations
      };
    } catch (err) {
      console.log('getPriceFluctuationsSku Function Err', err.message);
      throw new Error(`Oops! Something went wrong: ${err.message}`);
    }
  }

  async getBestSeller() {
      return this.SkusRepository
      .createQueryBuilder('skus')
      .where('skus.is_best_seller = :is_best_seller', { is_best_seller: 1 })
      .select([
        'skus.sku as sku'
      ])
      .groupBy('skus.sku')
      .getRawMany();
  }

  async getProductHealthAndBeauty() {
    return this.productRepository
      .createQueryBuilder('products')
      .innerJoin('products.productStocks', 'productStocks')
      .andWhere('products.product_category_id = :productCategoryId', { productCategoryId: 175 })
      .andWhere('products.product_type_id != :productTypeId', { productTypeId: productType.Gift })
      .andWhere('productStocks.stock_id = :stockId', { stockId: 2000 })
      .andWhere('(productStocks.available != :available OR productStocks.total_sold_qty != :totalSoldQty)', {available: 0, totalSoldQty: 0})
      .select([
        'products.sku sku'
      ])
      .groupBy('sku')
      .getRawMany();
  }

  async getTop300() {
    return this.getSkuTop300ToCache();
  }

  async getProductDetailsBySku(sku: string) {
    try {
      return this.productRepository
      .createQueryBuilder('products')
      .where('products.sku = :sku', { sku })
      .leftJoin('products.productStocks', 'productStocks')
      .andWhere('productStocks.stock_id = :stockId', { stockId: 2000 })
      .leftJoin('products.productBrand', 'productBrands')
      .leftJoin('products.vendorMaketing', 'vendorMaketings')
      .leftJoin('products.lastVendor', 'lastVendor')
      .select([
        'products.id',
        'products.sku',
        'products.name',
        'products.product_type',
        'products.brand',
        'products.categories',
        'products.country_of_manufacture',
        'products.vendor_marketing',
        'products.other_lowest_price',
        'products.other_lowest_price_url',
        'products.other_lowest_price_data',
        'products.check_prices_properties',
        'products.available_date',
        'products.hsk_price',
        'productBrands.id',
        'productBrands.name',
        'vendorMaketings.id',
        'vendorMaketings.vendor_id',
        'productStocks.id',
        'productStocks.sku',
        'productStocks.stock_id',
        'productStocks.in_stock',
        'lastVendor.vendor_name',
        'lastVendor.vendor_company'
      ])
      .getOne();
    } catch (error) {
      throw new Error(`Error getProductDetailsBySku: ${error}`);
    }
  }

  async getProductsBySkus(skus: any) {
    return this.productRepository
      .createQueryBuilder('products')
      .where('products.sku  IN (:...skus)', { skus })
      .select([
        'products.id',
        'products.sku',
        'products.name',
        'products.hsk_price',
        'products.hsk_base_price',
        'products.url_key',
        'products.status'
      ])
      .getMany();
  }

  async getShopActiveCount(sku: string, stockIds: any[]) {
    return this.productStocksRepository
      .createQueryBuilder('product_stocks')
      .where('product_stocks.sku = :sku', { sku })
      .andWhere('product_stocks.stock_id IN (:...stockIds)', { stockIds: stockIds })
      .andWhere('product_stocks.available > :available', { available: 0 })
      .select([
        'product_stocks.sku',
        'product_stocks.stock_id'
      ])
      .groupBy('product_stocks.sku, product_stocks.stock_id')
      .getCount();
  }

  async getInStockInProductStocks(sku: string) {
    try {
      return this.productStocksRepository
      .createQueryBuilder('product_stocks')
      .where('product_stocks.sku = :sku', { sku })
      .andWhere('product_stocks.stock_id = :stock_id', { stock_id: 2000 })
      .select([
        'product_stocks.sku',
        'product_stocks.in_stock',
        'product_stocks.real_available'
      ])
      .getOne();
    } catch (error) {
      throw new Error(`Error getInStockInProductStocks: ${error}`);
    }
  }

  async getSkuInProductStockTotalAvailable() {
    return this.productStocksRepository
      .createQueryBuilder('product_stocks')
      .andWhere('product_stocks.stock_id = :stock_id', { stock_id: 2000 })
      .andWhere('product_stocks.available > :available', { available: 0 })
      .select([
        'product_stocks.sku'
      ])
      .getMany();
  }

  async getStockBelow70Count(sku: string) {
    try {
      return this.SkusRepository
      .createQueryBuilder('skus')
      .where('skus.sku = :sku', { sku })
      .andWhere('skus.sold_month < :sold_month', { sold_month: 0.7 })
      .andWhere('skus.stock_id != :stock_id', { stock_id: 2000 })
      .select([
        'skus.id',
        'skus.sku',
      ])
      .getCount();
    } catch (error) {
      throw new Error(`getStockBelow70Count: ${error}`);
    }
  }

  async getPriceFluctuations(query: any) {
    const dateType = {
      time: 1,
      day: 2,
      week: 3,
      month: 4,
    }
    const endDate: Date = new Date(query?.endDate);
    endDate.setDate(endDate.getDate() + 1);
    const timesArray: number[] = [];
    
    // By time
    if (query.dateType == dateType.time){
      const startTimestamp = new Date(query?.startDate).getTime() / 1000; // Convert milliseconds to seconds
      const endTimestamp = endDate.getTime() / 1000; // Convert milliseconds to seconds
      for (let timestamp = startTimestamp; timestamp <= endTimestamp; timestamp += 3600) {
        const timestampLocal = timestamp - (7*60*60);
        timesArray.push(timestampLocal);
      }
    } 
    // By day
    else if (query.dateType == dateType.day) {
      let currentDate = new Date(query?.startDate)
      while (currentDate <= endDate) { 
        const dateWithoutTime: Date = new Date(currentDate); // Create a copy of currentDate
        dateWithoutTime.setHours(0, 0, 0, 0); // Reset time to 00:00:00
        const timestamp: number = dateWithoutTime.getTime() / 1000; // Convert to Unix timestamp
        timesArray.push(timestamp); // Push the Unix timestamp
        currentDate.setDate(currentDate.getDate() + 1); // Move to the next day
      }
    }

    // By week
    else if (query.dateType == dateType.week) {
      let currentDate = new Date(query?.startDate);
      const endDateWeek = new Date(query?.endDate);
      endDateWeek.setDate(endDateWeek.getDate() + 7);
      // Ensure currentDate starts at the beginning of the week (Sunday)
      while (currentDate.getDay() !== 0) {
        currentDate.setDate(currentDate.getDate() - 1);
      }
      currentDate.setHours(0, 0, 0, 0); 
    
      while (currentDate <= endDateWeek) {
        const startOfWeek = new Date(currentDate);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        if (startOfWeek <= endDateWeek && endOfWeek >= new Date(query?.startDate)) {
          const startTimestamp: number = startOfWeek.getTime() / 1000; 
          timesArray.push(startTimestamp); 
        }
        currentDate.setDate(currentDate.getDate() + 7); 
      }

      const firstWeek = new Date(query?.startDate);
      firstWeek.setHours(0, 0, 0, 0); 
      const firstWeekTimestamp = firstWeek.getTime() / 1000;
      
      const endWeek = new Date(query?.endDate);
      endWeek.setHours(23, 59, 59, 0); 
      const endWeekTimestamp = endWeek.getTime() / 1000;

      if(timesArray.length > 0) {
        timesArray[0] = firstWeekTimestamp;
        timesArray[timesArray.length - 1] = endWeekTimestamp;
      }
    }
    
    // By month
    else if (query.dateType == dateType.month) {
      let currentDate = new Date(query?.startDate);
      const endDateMonth = new Date(query?.endDate);
      endDateMonth.setMonth(endDateMonth.getMonth() + 1);
      while (currentDate <= endDateMonth) {
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        startOfMonth.setHours(0, 0, 0, 0); 
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0); 
        endOfMonth.setHours(23, 59, 59, 999); 

        if (startOfMonth <= endDateMonth && endOfMonth >= new Date(query?.startDate)) {
          const startTimestamp: number = startOfMonth.getTime() / 1000; 
          timesArray.push(startTimestamp); 
        }
        currentDate.setMonth(currentDate.getMonth() + 1); // Move to the next month
      }
      const firstMonth = new Date(query?.startDate);
      firstMonth.setHours(0, 0, 0, 0); 
      const firstMonthTimestamp = firstMonth.getTime() / 1000;

      const endMonth = new Date(query?.endDate);
      endMonth.setHours(23, 59, 59, 0); 
      const endMonthTimestamp = endMonth.getTime() / 1000;

      if(timesArray.length > 0) {
        timesArray[0] = firstMonthTimestamp;
        timesArray[timesArray.length - 1] = endMonthTimestamp;
      }
    }

    const data = [];
    for (let i = 0; i < timesArray.length - 1; i++) {
      const price = await this.elasticService.getPriceFluctuations(query?.sku, timesArray[i], timesArray[i+1], query);
      const item: any = {
        [`${timesArray[i]}-${timesArray[i+1]}`]: {
          price
        }
      }
      data.push(item);
    }
    return data;
  }

  async getNotOpenstockDB() {
    const notOpenstockInCache = await this.redisService.get(
      `${process.env.APP_ENV}${Cache.STOCK_NOT_OPEN_STOCK_ID_LIST}`
    );

    const keyShop = 'SHOP';
    return this.StocksRepository
      .createQueryBuilder('stocks')
      .where('stocks.id IN (:...ids)', { ids: notOpenstockInCache })
      .andWhere('stocks.name LIKE :keyShop', { keyShop: `%${keyShop}%` })
      .select([
        'stocks.id',
        'stocks.name',
      ])
      .getMany();
  }

  calculateStoreInstock(shopActive: number, stockShop: number) {
    return { shopActive, stockShop };
  }

  async getStoreInStock(sku: string, stockIds: any[]) {
    try {
      const [shopActive]: [number] = await Promise.all([
        this.getShopActiveCount(sku, stockIds)
      ]);
      const storeInstock = this.calculateStoreInstock(shopActive, stockIds.length);
      return storeInstock;
    } catch (error) {
      throw new Error(`Error getStoreInStock: ${error}`);
    }
  }

  async getReceiptDetails(startDateFirst: string) {
    return this.receiptDetailsRepository
      .createQueryBuilder('receipt_details')
      .leftJoin('receipt_details.receipt', 'receipt')
      .leftJoin('receipt.store', 'store')
      .where('DATE(receipt.created_at) = :date', { date: startDateFirst })
      .andWhere('receipt.receipt_status != :status', { status: OrderTracking.RECEIPT_CANCEL })
      .select([
        'receipt_details.receiptdt_id',
        'receipt_details.receiptdt_receipt_id',
        'receipt_details.receiptdt_sku',
        'receipt_details.receiptdt_price',
        'receipt_details.receiptdt_discount',
        'receipt_details.receiptdt_qty',
        'receipt_details.receiptdt_ctime',
        'receipt.receipt_store_id',
        'receipt.receipt_cdate',
        'receipt.receipt_udate',
        'receipt.receipt_code',
        'receipt.created_at',
        'receipt.updated_at',
        'store.store_stock_id',
        'store.store_name',
      ])
      .getMany();
  }

  async getSku(query: any) {
    try {
      const { data, total } = await this.elasticService.getSku(query);
      return { data, total };
    } catch (err) {
      console.log('getSku Function Err', err.message);
      throw new Error(`Oops! Something went wrong: ${err.message}`);
    }
  }

  async exportDataExcel(query: any) {
    try {
      const { dates, body, afterKey } = await this.elasticService.runAggregationDataExcel(query);
      const availableStores: any[] = await this.ecomerceService.getEcommerceAvailableStores();
      const stockIds: any[] = availableStores.map(item => item.stock_id);
      await Promise.all(
        body.map(async (item: any) => {
          if (item?.key?.itemId) {
            const inStock: any = await this.getInStockInProductStocks(item.key.itemId);
            const storeInstock = await this.getStoreInStock(item.key.itemId, stockIds);
            return item.moreInfo = { inStock: inStock?.in_stock, storeInstock };
          }
        }),
      );
      let res = this.elasticService.mapDataExcel(body, dates, query['type']);
      res['afterKey'] = afterKey;
      return res;
    } catch (e) {
      console.error(`analytics.service.exportDataExcel:${e.message}`);
      throw new Error(e.message);
    }
  }

  async exportMasterDetailQueue(query: any) {
    const data: any = getObjectExcel(query, this.endPoindIO, this.bucketIO);
    query.esRow = data;
    const sqlQueryString: string = data?.sqlQueryString ?? "";
    try {
      const date = new Date();
      const stringNumber = date.getTime().toString();
      const index = stringNumber + "-" + data.userId  + "-" + generateUniqueString();
  
      const queryParams:  { userId?: any, sqlQueryString?: string, status: number } = {
        userId: query.userId,
        sqlQueryString: sqlQueryString,
        status: statusFileDownload.completed
      }
      const itemFileFileHstory:any[] = await this.elasticService.runGetFileHistoryByCondition(queryParams);
      if (itemFileFileHstory.length > 0) {
        return {
          message: "The user has exported the excel file",
          data: itemFileFileHstory[0]  
        }
      }
      await this.elasticService.indexDownloadFileES(data, index);
      const jobProcessorMasterData:string = `${process.env.EXCEL_MASTER_QUEUE_PROCESSOR}`;
      await this.queueService.addJob(query, jobProcessorMasterData);
      return "Export excel is processing";
    } catch (e) {
      await this.elasticService.updateDownloadFileES(query.esRow, statusFileDownload.failure);
      console.log("err exportMasterDetailQueue");
      throw new Error(`ZipService: ${e}`);
    }
  }

  async exportMasterDetail(query: any) {
    const esRow: any = query.esRow;
    const folderExcelPath: string = `Export/${query.nameFileFolder}/`;
    const folderZipPath: string = query.folderZipPath;
    const zipName: string = `${query.nameFileFolder}${query.typeFile}`;
    const nameUserFile: string = query.nameUserFile;
    try {
      const dataExitFolder: any[] = await this.elasticService.runGetFileHistoryBySqlQueryString(esRow.sqlQueryString);
      if (dataExitFolder.length === 0) {
        query['isExcel'] = true;
        const perPage: number = query.perPage;
        const q: any = {
          endDate: query.endDate,
          startDate: query.startDate,
          perPage: 2000,
          filter: query.filter,
          order: query?.order || false,
        };

        let isLoop = true;
        let dataExcel: DataExcel;
        let data = [];
        let count: number = 1;
        let heading: any[] = [];
        createTemporaryFile(folderExcelPath, folderZipPath);
        let fileZarPaths: string[] = [];
        let fileNameExcel: string = '';

        while (isLoop) {
          const { body, search_after } = await this.elasticService.runQueryOrderDetail(q);
          const availableStores: any[] = await this.ecomerceService.getEcommerceAvailableStores();
          const stockIds = availableStores.map(item => item.stock_id);
          const promotionData = await this.ecomerceService.getEcommercePromotionAllRule();
          await Promise.all(body.map(async (item: any) => {
            if (item?.itemId.value) {
              const [inStock, storeInstock, products, stockBelow70, promotionInfo] = await Promise.all([
                this.getInStockInProductStocks(item.itemId.value),
                this.getStoreInStock(item.itemId.value, stockIds),
                this.getProductDetailsBySku(item.itemId.value),
                this.getStockBelow70Count(item.itemId.value),
                this.getEcomercePromotionBySku(item.itemId.value, promotionData),
              ]);

              const { giftsURLs, vouchersURLs, activeRule } = promotionInfo;

              item.moreInfo = {
                inStock: inStock?.in_stock,
                storeInstock,
                minPrice: products?.other_lowest_price || 0,
                minPriceUrls: products?.other_lowest_price_url || '',
                stockBelow70: stockBelow70,
              };

              item.itemGifts = { value: giftsURLs, name: 'Gifts' };
              item.itemVouchers = { value: vouchersURLs, name: 'Vouchers' };
              item.itemActiveRule = { value: activeRule, name: 'Active Rule' };
              item.itemHasakiPrice = { value: products?.hsk_price, name: 'Hasaki Price' };
              item.vendor = { value: convertVendorAndCompanyName(products?.lastVendor?.vendor_name, products?.lastVendor?.vendor_company), name: 'Vendor' };
            }
          }));

          const res = this.elasticService.mapDataOrderDetail(body);
          q.search_after = search_after;
          data = [...data, ...res['data']];
          heading = res['heading'].length > 0 ? res['heading'] : heading;

          if (data.length >= perPage) {
            fileNameExcel = `${folderExcelPath}${nameUserFile}(${count}).xlsx`;
            dataExcel = { nameFile: fileNameExcel, heading, rawData: data };
            fileZarPaths.push(fileNameExcel);
            await this.excelService.exportToExcel(dataExcel);
            data = [];
            count += 1;
          }

          if (res['data'].length === 0) {
            isLoop = false;
          }
        }

        fileNameExcel = `${folderExcelPath}${nameUserFile}(${count}).xlsx`;
        dataExcel = { nameFile: fileNameExcel, heading, rawData: data };
        fileZarPaths.push(fileNameExcel);
        await this.excelService.exportToExcel(dataExcel);
        await this.zipService.zipFiles(fileZarPaths, `${folderZipPath}${zipName}`);
        await cleanupFolders([folderExcelPath, folderZipPath]);
      }
      await this.elasticService.updateDownloadFileES(esRow, statusFileDownload.completed);
      return query;
    } catch (err) {
      console.error('exportMasterDetail Err', err.message);
      await cleanupFolders([folderExcelPath, folderZipPath]);
      await this.elasticService.updateDownloadFileES(esRow, statusFileDownload.failure);
      throw new Error(`Oops! Something went wrong: ${err.message}`);
    }
  }

  async dowloadExcelHistory(query: any) {
    const userId: string = query?.userId ?? "";
    const excelPage: string = query?.excelPage ?? "";
    const data:any = await this.elasticService.runGetFileHistoryByUserId(userId, excelPage);
    return data;
  }

  async getListOrderDetail(query: any) {
      try {
        const res: any = {}
        const { body, totalPage, totalValue, search_after } = await this.elasticService.runQueryOrderDetail(query);
        const availableStores: any[] = await this.ecomerceService.getEcommerceAvailableStores();
        const stockIds: any[] = availableStores.map(item => item.stock_id);
        const promotionData = await this.ecomerceService.getEcommercePromotionAllRule();
        await Promise.all(
          body.map(async (item: any) => {
            if (item?.itemId.value) {
              const inStock: any = await this.getInStockInProductStocks(item.itemId.value);
              const storeInstock = await this.getStoreInStock(item.itemId.value, stockIds);
              const products = await this.getProductDetailsBySku(item.itemId.value);
              const stockBelow70 = await this.getStockBelow70Count(item.itemId.value);
              const {giftsURLs, vouchersURLs, activeRule} = await this.getEcomercePromotionBySku(item.itemId.value, promotionData);
              (item.moreInfo = {
                inStock: inStock?.in_stock,
                storeInstock,
                minPrice: products?.other_lowest_price && products.other_lowest_price != null ? products.other_lowest_price : 0,
                minPriceUrls: products?.other_lowest_price_url && products.other_lowest_price_url != null ? products.other_lowest_price_url : '',
                stockBelow70: stockBelow70,
              });
              item.itemGifts = {
                value: giftsURLs,
                name: 'Gifts'
              };
              item.itemVouchers = {
                value: vouchersURLs,
                name: 'Vouchers'
              };
              item.itemActiveRule = {
                value: activeRule,
                name: 'Active Rule'
              };
              item.itemHasakiPrice = {
                value: products?.hsk_price,
                name: 'Hasaki Price'
              };
              item.vendor = {
                value: convertVendorAndCompanyName(products?.lastVendor?.vendor_name, products?.lastVendor?.vendor_company),
                name: 'Vendor'
              };
            }
          }),
        );
        res['body'] = body;
        res['totalPage'] = totalPage;
        res['totalValue'] = totalValue;
        res['search_after'] = search_after

        return res;
      } catch (error) {
        console.log("getListOrderDetail: ", error.message);
        throw error;
      }
  }

  async getPriceOnShopee(): Promise<any[]> {
    try {
      const priceInfoList: any[] = await this.elasticService.getAllPriceInfo(); 
      const productsDB: any[] = await this.productRepository.find({
        relations: ['productBrand'],
        select: {
          id: true,
          sku: true,
          name: true,
          product_type_id: true
        },
      });
      const bestSellers: any[] = await this.getBestSeller();
      const skuTop300:any[] = await this.getSkuTop300ToCache();
      const listSkuTop300: any[] = skuTop300.map(item => item.sku);
      const ids: string[] = convertNumberArrayToStringArray(listSkuTop300);
      let idsCopy: string[] = [...ids];
      const query: any = {
        offset: 0,
        page_size: 100,
        item_status: 'NORMAL'
      };  
      let itemList: number[] = [];
      let itemListBaseInfo: any[] = [];
      let itemListES: any[] = [];
      let modelListIds: any[] = [];
      // Retrieve item IDs from Shopee service
      do {
        const itemListRes: any = await this.shopeeService.getItemList(query);
        if (!itemListRes || !itemListRes.item || itemListRes.item.length === 0) {
          break;
        }
        itemList.push(...itemListRes.item.map((e: any) => e.item_id));
        query.offset += query.page_size;
      } while (true);
      // Fetch base information for items in batches
      const batchSize: number = 50;
      for (let i = 0; i < itemList.length; i += batchSize) {
        const itemIds: number[] = itemList.slice(i, i + batchSize);
        const baseInfo = await this.shopeeService.getItemBaseInfo(itemIds);
          if (baseInfo?.item_list && baseInfo?.item_list.length > 0) {
            for(const e of baseInfo.item_list){
              if (ids.includes(e.item_sku)) {
                itemListBaseInfo.push({
                  itemId: e.item_id,
                  itemSku: e.item_sku,
                  itemName: e.item_name,
                  categoryId: e.category_id,
                  priceInfo: e?.price_info ?? '',
                  itemStatus: e.item_status
                })
              } else if (!e.item_sku || e.item_sku === "") {
                modelListIds.push({
                  itemId: e.item_id,
                  categoryId: e.category_id,
                  itemStatus: e.item_status
                })
              }
            }
          }
      }
      for (const baseItem of itemListBaseInfo) {
        const objBySku = getObjectBySku(baseItem.itemSku?.toString(), productsDB, 'sku');
        const sellerSku:string = baseItem.itemSku?.toString();
        const defaultObj: any = {
          itemIdShopee: `${baseItem.itemId || ''}`, 
          currentPriceShopee: baseItem?.priceInfo[0]?.current_price || -1, 
          originalPriceShopee: baseItem.priceInfo[0]?.original_price || -1, 
          statusShopee: baseItem.itemStatus,
          categoryId: baseItem.categoryId,
          modelName: '',
        };
        const item: any = {
          sku: sellerSku,
          item_name: objBySku?.name || '',
          // Tiktok
          ...createPlatformData(Define.Channel.tiktok, {}),
          // Shopee
          ...createPlatformData(Define.Channel.shopee, defaultObj),
          // Lazada
          ...createPlatformData(Define.Channel.lazada, {}),
          // Hasaki
          ...createPlatformData(Define.Channel.hasaki, {}),
          //
          is_best_seller: checkIdInArrayExists(bestSellers, 'sku', sellerSku) ? true : false,
          brand: objBySku?.productBrand?.name ?? "",
          product_type: objBySku?.product_type_id ?? 0,
        };
        itemListES.push(item);
      };
      const promises = modelListIds.map(async (model: any) => {
        const modelList = await this.shopeeService.getModeList(model.itemId);
        if (modelList?.model && modelList?.model.length > 0) {
          const items = modelList.model.map((ele: any) => {
            const objBySku = getObjectBySku(ele.model_sku, productsDB, 'sku');
            const sellerSku:string = ele.model_sku;
            const defaultObj: any = {
              itemIdShopee: `${model.itemId || ''}`, 
              currentPriceShopee: ele.price_info[0]?.current_price || -1, 
              originalPriceShopee: ele.price_info[0]?.original_price || -1, 
              statusShopee: model.itemStatus,
              categoryId: model.categoryId,
              modelName: ele.model_name,
            };
              return {
                sku: sellerSku,
                item_name: objBySku?.name || '',
                // Tiktok
                ...createPlatformData(Define.Channel.tiktok, {}),
                // Shopee
                ...createPlatformData(Define.Channel.shopee, defaultObj),
                // Lazada
                ...createPlatformData(Define.Channel.lazada, {}),
                // Hasaki
                ...createPlatformData(Define.Channel.hasaki, {}),
                //
                is_best_seller: checkIdInArrayExists(bestSellers, 'sku', sellerSku) ? true : false,
                brand: objBySku?.productBrand?.name ?? "",
                product_type: objBySku?.product_type_id ?? 0,
              };
            }
          );
          return items;
        } 
        return [];
      });
      // Execute all promises con currently using Promise.all
      const results: any[] = await chunkAndExecPromiseAll({chunkSize:50, array: promises});
      results.forEach((items: any) => {
        if(items && items.length > 0){
          itemListES.push(...items);
        }
      });
      for (const e of itemListES) {
        this.removeProcessedSku(idsCopy, e.sku);
      }
      if (idsCopy.length > 0) {
        const listESNotSetPrice: any[] = idsCopy.map(sku => this.createEmptyPriceInfo(bestSellers, sku, Define.Channel.shopee, productsDB));
        itemListES = [...itemListES, ...listESNotSetPrice];
      }
      const fieldsToChange: string[] = ['item_id_shopee', 'current_price_shopee', 'original_price_shopee', 'status_shopee', 'category_id', 'model_name'];
      const listIndexES: any[] = mergeArrays(priceInfoList, itemListES, fieldsToChange, Define.Channel.shopee);
      if(listIndexES.length > 0){
        await this.elasticService.deleteAllDocuments(process.env.EE_PRICE_INFO);
        await this.indexPriceInfoToElastic(listIndexES, Define.Channel.shopee);
        // await this.indexPriceHistoryInfoToElastic(listIndexES);
      }
      return [{listIndexES, itemList, itemListLength: itemList.length}];
    } catch (error) {
      console.log("ERRORS getPriceOnShopee", error);
      return error;
    }
  }

  async getPriceOnLazada(): Promise<any[]> {
    try {
      console.log("get getPriceOnLazada");
      const priceInfoList: any[] = await this.elasticService.getAllPriceInfo(); 
      const productsDB: any[] = await this.productRepository.find({
        relations: ['productBrand'],
        select: {
          id: true,
          sku: true,
          name: true,
          product_type_id: true
        },
      });
      const bestSellers: any[] = await this.getBestSeller();
      let itemList: any = [];
      const skuTop300:any[] = await this.getSkuTop300ToCache();
      const listSkuTop300: any[] = skuTop300.map(item => item.sku);
      const ids: string[] = convertNumberArrayToStringArray(listSkuTop300);
      let idsCopy: string[] = [...ids];
        let isRun: boolean = true;
        const query: any = {
          offset: 0,
          limit: 50
        };
      let i = 1;
      let productLength: number = 0;
      let totalProducts: number = 0;
      while (isRun) {
        const itemListRes: any = await this.lazadaService.getItemList(query); 
        if (!itemListRes?.data?.products?.length) {
          isRun = false;
          break;
        }
        productLength += itemListRes?.data?.products?.length;
        totalProducts = itemListRes?.data?.total_products;
        let listES = []
        for (const product of itemListRes.data.products) {
          if (product.status !== 'Active') {
            continue;
          }
          for (const sku of product.skus) {
            if (sku.Status !== 'active' || !ids.includes(sku?.SellerSku)) {
              continue;
            }
            const item = this.createPriceInfo(bestSellers, product, sku, productsDB);
            this.removeProcessedSku(idsCopy, item.sku);
            listES = [...listES, item];
          }
        }
        query.offset += query.limit;
        itemList = [...itemList, ...listES];
        console.log("sleep")
        await sleep(10000);
      }
      if(productLength < totalProducts){
        throw new Error("Call limit to shopee");
      }
      if (itemList.length <= 0) {
        return itemList;
      }
      if (idsCopy.length > 0) {
        const listESNotSetPrice: any[] = idsCopy.map(sku => this.createEmptyPriceInfo(bestSellers, sku, Define.Channel.lazada, productsDB));
        itemList.push(...listESNotSetPrice);
      }
      const fieldsToChange: string[] = ['item_id_lazada', 'current_price_lazada', 'original_price_lazada', 'status_lazada', 'url_lazada_key'];
      const listIndexES: any[] = mergeArrays(priceInfoList, itemList, fieldsToChange, Define.Channel.lazada);
      if(listIndexES.length > 0){
        await this.elasticService.deleteAllDocuments(process.env.EE_PRICE_INFO);
        await this.indexPriceInfoToElastic(listIndexES, Define.Channel.lazada);
      }
      console.log("end getPriceOnLazada");
      return listIndexES;
    } catch (error) {
      console.error("ERRORS: getPriceOnLazada", error);
      return error;
    }
  }
  
  private createPriceInfo(bestSellers: any[], product: any, sku: any, productsDB: any[]): any {
    const skuStr: string = sku?.SellerSku?.toString()
    const objBySku: any = getObjectBySku(skuStr, productsDB, 'sku');
    const defaultObj: any = {
      itemIdLazada: `${product?.item_id || ''}`,
      currentPriceLazada: sku?.special_price || -1, 
      originalPriceLazada: sku?.price || -1, 
      statusLazada: sku.Status,
      urlLazadaKey: sku.Url,
    };
    return {
      sku: skuStr,
      item_name: objBySku?.name || '',
      // Tiktok
      ...createPlatformData(Define.Channel.tiktok, {}),
      // Shopee
      ...createPlatformData(Define.Channel.shopee, {}),
      // Lazada
      ...createPlatformData(Define.Channel.lazada, defaultObj),
      // Hasaki
      ...createPlatformData(Define.Channel.hasaki, {}),
      //
      is_best_seller: checkIdInArrayExists(bestSellers, 'sku', skuStr) ? true : false,
      brand: objBySku?.productBrand?.name ?? "",
      product_type: objBySku?.product_type_id ?? 0,
    };
  }
  
  private removeProcessedSku(idsCopy: string[], sku: string): void {
    const index = idsCopy.indexOf(sku);
    if (index > -1) {
      idsCopy.splice(index, 1);
    }
  }
  
  private createEmptyPriceInfo(bestSellers: any[], sku: string, channel: string, productsDB: any[]): any {
    const objBySku = getObjectBySku(sku, productsDB, 'sku');
    const itemId: string = this.generateUniqueKeyWithTimestamp();
    return {
      sku: sku,
      item_name: objBySku?.name || '',
      // Tiktok
      ...createPlatformData(Define.Channel.tiktok, {itemIdTiktok: channel === Define.Channel.tiktok ?  itemId : ''}),
      // Shopee
      ...createPlatformData(Define.Channel.shopee, {itemIdShopee: channel === Define.Channel.shopee ?  itemId : ''}),
      // Lazada
      ...createPlatformData(Define.Channel.lazada, {itemIdLazada: channel === Define.Channel.lazada ?  itemId : ''}),
      // Hasaki
      ...createPlatformData(Define.Channel.hasaki, {itemIdHasaki: channel === Define.Channel.hasaki ?  itemId : ''}),
      is_best_seller: checkIdInArrayExists(bestSellers, 'sku', sku) ? true : false,
      brand: objBySku?.productBrand?.name ?? "",
      product_type: objBySku?.product_type_id ?? 0,
    };
  }

  async getPriceOnTiktok(): Promise<any> {
    try {
      const priceInfoList: any[] = await this.elasticService.getAllPriceInfo();
      const skuTop300:any[] = await this.getSkuTop300ToCache();
      const productsDB: any[] = await this.productRepository.find({
        relations: ['productBrand'],
        select: {
          id: true,
          sku: true,
          name: true,
          product_type_id: true,
        },
      });
      const bestSellers: any[] = await this.getBestSeller();
      const listSkuTop300: any[] = skuTop300.map(item => item.sku);
      const ids: string[] = convertNumberArrayToStringArray(listSkuTop300);
      let idsCopy: string[] = [...ids];
      let productList: any[] = [];
      const q: any = {
        pageSize: 100
      }
      let isTrue = true
      while (isTrue) { 
        const products: any = await this.tiktokService.searchProducts(q);
        if(products.data.total_count === 0 || !products.data?.products){
            isTrue = false;
            break;
        }
        q.nextPageToken = products?.data?.next_page_token ?? "";
        if (products?.data?.products) {
          productList = [...productList, ...products?.data?.products];
        }
      }
      const activitieParams: any = {
        pageSize: 100,
        nextPageToken: ''
      }
      let searchActivities: any[] = [];

      while (true) {
        const searchActityData: any = await this.tiktokService.searchActivities(activitieParams);
        searchActivities = [...searchActivities, ...searchActityData.data.activities];
        activitieParams.nextPageToken = searchActityData.data?.next_page_token;
        if (searchActityData.data.total_count <= searchActivities.length) {
          break;
        }
      }
      for (const searchActivity of searchActivities) {
        const { activity_type, id } = searchActivity;
        if ([typePromotionTiktok.fixedPrice, typePromotionTiktok.directDiscount].includes(activity_type)) {
          const activities = await this.tiktokService.getActivities(id);
          
          if (activities?.data?.products) {
            for (const activity of activities.data.products) {
              productList.forEach((e: any) => {
                if (e.id === activity.id) {
                  e.promotionType = activity_type;
                  let skuPromotion:any[] = [];
                  activity.skus.forEach((e: any) => {
                    skuPromotion = [...skuPromotion, {
                      id: e.id,
                      id_activity: id,
                      activity_price: e.activity_price,
                      discount: e.discount,
                      activity_type
                    }]
                  });
                  if(e?.sku_promotion && e?.sku_promotion.length >= 0){
                    e.sku_promotion = [...e.sku_promotion, ...skuPromotion];
                  } else {
                    e.sku_promotion = skuPromotion;
                  }
                }
              });
            }
          }
        }
      }
      let listES: any[] = [];
      productList.forEach((product: any) => {
        product.skus.forEach((sku: any) => {
          if (!ids.includes(sku?.seller_sku)) {
            return;
          }
          let promotions: any = '';
          if (product?.sku_promotion) {
            promotions = findLowestPriceForId(product.sku_promotion, sku.id);
          }

          for(const promotion of promotions) {
            let currentPrice: number = -1;
            const originPrice: number = Number(sku.price.tax_exclusive_price);
            if(product.promotionType === typePromotionTiktok.fixedPrice){
              currentPrice = promotion ? Number(promotion.activity_price.amount) : originPrice;
            } else if(product.promotionType === typePromotionTiktok.directDiscount) {
              const salePrice: number = originPrice - (Number(promotion.discount) / 100 * originPrice);
              currentPrice = promotion ? Number(salePrice) : originPrice;
            }
            const objBySku: any = getObjectBySku(sku.seller_sku, productsDB, 'sku');
            const sellerSku: string = sku.seller_sku;
            const idActivity: string = promotion ? promotion.id_activity : '';
            const item: any = {
              sku: sellerSku,
              item_name: objBySku?.name || '',
              // Tiktok
              ...createPlatformData(Define.Channel.tiktok, {itemIdTiktok: `${product.id || ''}`,currentPriceTiktok: currentPrice, originalPriceTiktok: sku.price.tax_exclusive_price, statusTiktok: product.status, idActivity}),
              // Shopee
              ...createPlatformData(Define.Channel.shopee, {}),
              // Lazada
              ...createPlatformData(Define.Channel.lazada, {}),
              // Hasaki
              ...createPlatformData(Define.Channel.hasaki, {}),
              is_best_seller: checkIdInArrayExists(bestSellers, 'sku', sellerSku) ? true : false,
              brand: objBySku?.productBrand?.name ?? "",
              product_type: objBySku?.product_type_id ?? 0,
            };
            this.removeProcessedSku(idsCopy, item.sku);
            listES = [...listES, item];
          }
        });
      });
      if (idsCopy.length > 0) {
        const listESNotSetPrice: any[] = idsCopy.map(sku => this.createEmptyPriceInfo(bestSellers, sku, Define.Channel.tiktok, productsDB));
        listES.push(...listESNotSetPrice);
      }
      const fieldsToChange: string[] = ['sku', 'item_name', 'item_id_tiktok', 'current_price_tiktok', 'original_price_tiktok', 'status_tiktok', 'id_activity', 'is_best_seller', 'product_type'];
      const listIndexES: any[] = mergeArrays(listES, priceInfoList, fieldsToChange, Define.Channel.tiktok);
      if(listIndexES.length > 0){
        await this.elasticService.deleteAllDocuments(process.env.EE_PRICE_INFO);
        await this.indexPriceInfoToElastic(listIndexES, Define.Channel.tiktok);
        // await this.indexPriceHistoryInfoToElastic(listES);
      }
      return listIndexES;
    } catch (error) {
      console.log("ERRORS: getPriceOnTiktok", error);
      return error;
    }
  }

  async getPriceOnHasaki(): Promise<any[]> {
    
    try {
      const priceInfoList: any[] = await this.elasticService.getAllPriceInfo(); 
      const productsDB: any[] = await this.productRepository.find({
        relations: ['productBrand'],
        select: {
          id: true,
          sku: true,
          name: true,
          product_type_id: true
        },
      });
      const skuTop300:any[] = await this.getSkuTop300ToCache();
      const listSkuTop300: any[] = skuTop300.map(item => item.sku);
      const bestSellers: any[] = await this.getBestSeller();
      const ids: string[] = convertNumberArrayToStringArray(listSkuTop300);
      let idsCopy: string[] = [...ids];
      let itemListES: any[] = [];
      if (listSkuTop300.length <= 0) {
        return itemListES;
      }
      let listES: any[] = []
      const itemListRes: any[] = await this.getProductsBySkus(listSkuTop300)
      itemListRes.forEach((product: any) => {
        const defaultObj: any = {
          itemIdHasaki: `${product?.id || ''}`, 
          currentPriceHasaki: product?.hsk_price, 
          originalPriceHasaki: product?.hsk_base_price, 
          statusHasaki: product?.status === 1 ? "Active" : "Inactive",
          urlKey: product?.url_key || '',
        };
        const sellerSku: string = product?.sku?.toString();
        const objBySku = getObjectBySku(product?.sku, productsDB, 'sku');
        const item: any = {
          sku: sellerSku,
          item_name: product?.name || '',
          // Tiktok
          ...createPlatformData(Define.Channel.tiktok, {}),
          // Shopee
          ...createPlatformData(Define.Channel.shopee, {}),
          // Lazada
          ...createPlatformData(Define.Channel.lazada, {}),
          // Hasaki
          ...createPlatformData(Define.Channel.hasaki, defaultObj),
          //
          is_best_seller: checkIdInArrayExists(bestSellers, 'sku', sellerSku) ? true : false,
          brand: objBySku?.productBrand?.name ?? "",
          product_type: objBySku?.product_type_id ?? 0,
        }
        this.removeProcessedSku(idsCopy, item.sku);
        listES = [...listES, item]
      });
      if (idsCopy.length > 0) {
        const listESNotSetPrice: any[] = idsCopy.map(sku => this.createEmptyPriceInfo(bestSellers, sku, Define.Channel.hasaki, productsDB));
        listES.push(...listESNotSetPrice);
      }
      const fieldsToChange: string[] = ['item_id_hasaki', 'current_price_hasaki', 'original_price_hasaki', 'status_hasaki', 'url_key'];
      const listIndexES: any[] = mergeArrays(priceInfoList, listES, fieldsToChange, Define.Channel.hasaki);
      if (listIndexES.length > 0) {
        await this.elasticService.deleteAllDocuments(process.env.EE_PRICE_INFO);
        await this.indexPriceInfoToElastic(listIndexES, Define.Channel.hasaki);
        // await this.indexPriceHistoryInfoToElastic(listIndexES);
      }
      return listIndexES;
    } catch (error) {
      console.log("ERRORS: getPriceOnHasaki", error);
      return error;
    }
  }

  async getAllPriceInfo(): Promise<any[]> {
    try {
      return this.elasticService.getAllPriceInfo();
    } catch (error) {
      console.log("ERRORS: getAllPriceInfo");
      console.log(error.message);
      return [];
    }
  }
  
  async getEcomercePromotion() {
    const promotionData = await this.ecomerceService.getEcommercePromotionAllRule();
    return promotionData;
  }

  async getEcomercePromotionBySku(sku: string, promotionData: any) {
    try {
      let giftsURLs: string[] = [], vouchersURLs: string[] = [], activeRule: number = 0;
      if (!promotionData) {
        return {
          giftsURLs,
          vouchersURLs,
          activeRule
        }
      }
      const timestamp = getTimestamp();
      if (sku in promotionData) {
        const promotions = checkPromotion(promotionData[sku]);
        promotionData[sku].forEach((rule: any) => {
          if (timestamp <= rule.end_time) {
            activeRule = promotionData[sku].length;
            if (promotions?.vouchers && promotions.vouchers.length > 0 && !vouchersURLs.length) promotions.vouchers.forEach((ele: any) => vouchersURLs.push(ele.url));
            if (promotions?.gifts && promotions.gifts.length > 0 && !giftsURLs.length) promotions.gifts.forEach((ele: any) => giftsURLs.push(ele.url));
          }
        });
      }
      return {
        giftsURLs,
        vouchersURLs,
        activeRule
      }
    } catch (error) {
      throw new Error(`getEcomercePromotionBySku: ${error}`);
    }
  }

  async trackingPerformanceSku(query: any) {
    return await this.elasticService.trackingPerformanceSku(query);
    const { isCompare, dates, total, body, totalPage, terms } = await this.elasticService.trackingPerformanceSku(query);
    const availableStores: any[] = await this.ecomerceService.getEcommerceAvailableStores();
    const stockIds: any[] = availableStores.map(item => item.stock_id);
    await Promise.all(
      body.map(async (item: any) => {
        const keys: [] = Array.isArray(item?.key) ? item?.key : [item?.key];
        const index = getIndexOfObject(terms, "itemId");
        if (index >= 0 && keys[index]) {
          const realAvailable: any = await this.getInStockInProductStocks(keys[index]);
          const storeInstock = await this.getStoreInStock(keys[index], stockIds);
          const objBySku = await this.getProductDetailsBySku(keys[index]);
          item.moreInfo = { 
            realAvailable: realAvailable?.real_available, 
            storeInstock, 
            skuName: objBySku?.name,
            hskPrice: objBySku?.hsk_price || 0,
            minPrice: objBySku?.other_lowest_price && objBySku.other_lowest_price != null ? objBySku.other_lowest_price : 0,
            minPriceUrls: objBySku?.other_lowest_price_url && objBySku.other_lowest_price_url != null ? objBySku.other_lowest_price_url : '',
            vendor: convertVendorAndCompanyName(objBySku?.lastVendor?.vendor_name, objBySku?.lastVendor?.vendor_company),
            brand: objBySku?.brand || ''
          };
        }
      })
    );
    return { isCompare, dates, total, body, totalPage };
  }

  async trackingCostBySku(query: any) {
    const { isCompare, dates, total, body, totalPage, terms } = await this.elasticService.trackingCostBySku(query);
    await Promise.all(
      body.map(async (item: any) => {
        const keys: any[] = Array.isArray(item?.key) ? item?.key : [item?.key];
        const index: any = getIndexOfObject(terms, "sku");
        const campaignIndex: any = getIndexOfObject(terms, "campaign_id");
        const campaignId: any = keys[campaignIndex];
        if (index >= 0 && keys[index]) {
          const objBySku = await this.getProductDetailsBySku(keys[index]);
          item.moreInfo = { 
            skuName: objBySku?.name,
            campaignId,
          };
        } 
        if(campaignId) {
          const objShoppings: any[] = await this.elasticService.getShoppingPerformanceById({campaign_id: campaignId});
          if (objShoppings.length > 0) {
            item.moreInfo.campaignName = objShoppings[0]?.campaign_name;
          }
        }
      })
    );
    return { isCompare, dates, total, body, totalPage };
  }

  async trackingSkuCampaignOrder(query: any) {
    const campaignId: any = query?.campaignId;
    const sku: any =  query?.sku;
    const startDate: string = getDateFormat(query?.startDate);
    const endDate: string =  getDateFormat(query?.endDate);
    const campaignParams: any = {
      campaignIds: [campaignId],
      startDate,
      endDate,
    }
    const campaignResult: any[] = await this.elasticService.getCampaignByCondition(campaignParams);
    const transactionIds: any[] = campaignResult.filter((campaign) => campaign.transactionId !== "").map((campaign) => {
      return campaign.transactionId;
    })
    const orderList: any[] = [];
    if(transactionIds.length > 0){
      const analyticParams: any = {
        channels: [channel.ga4app, channel.ga4web],
        itemIds: [sku],
        itemOrderIds: transactionIds,
        channelFlags: [channelFlag.inside],
      }
      const analyticResult:any[] = await this.elasticService.getAnalyticsByCondition(analyticParams);
        for (const e of analyticResult) {
          orderList.push({
            sku: e.itemId,
            orderCode: e.itemOrderId,
            purchaseInside: e.itemsPurchasedInside,
            revenueInside: e.itemRevenueInside
          })
        }
    }
    return orderList;
  }

  async exportTrackingPerformanceSkuExcel(query: any) {
    const { isCompare, dates, total, body, totalPage, terms } = await this.elasticService.trackingPerformanceSku(query);
    const availableStores: any[] = await this.ecomerceService.getEcommerceAvailableStores();
    const stockIds: any[] = availableStores.map(item => item.stock_id);
    await Promise.all(
      body.map(async (item: any) => {
        const keys: [] = Array.isArray(item?.key) ? item?.key : [item?.key];
        const index = getIndexOfObject(terms, "itemId");
        if (index >= 0 && keys[index]) {
          const realAvailable: any = await this.getInStockInProductStocks(keys[index]);
          const storeInstock = await this.getStoreInStock(keys[index], stockIds);
          const objBySku = await this.getProductDetailsBySku(keys[index]);
          item.moreInfo = { 
            realAvailable: realAvailable?.real_available, 
            storeInstock, 
            skuName: objBySku?.name,
            hskPrice: objBySku?.hsk_price || 0,
            minPrice: objBySku?.other_lowest_price && objBySku.other_lowest_price != null ? objBySku.other_lowest_price : 0,
            minPriceUrls: objBySku?.other_lowest_price_url && objBySku.other_lowest_price_url != null ? objBySku.other_lowest_price_url : '',
            vendor: convertVendorAndCompanyName(objBySku?.lastVendor?.vendor_name, objBySku?.lastVendor?.vendor_company),
            brand: objBySku?.brand || ''
          };
        }
      })
    );
    let heading: string[] = [];

    if(isCompare){
      heading = [
        'Sku', 
        'Product Name', 'Brand', 'Vendor', 
        `Tổng số sold: ${dates[0]}`,
        `Tổng số sold: ${dates[1]}`,
        `Tổng số sold: Change`,
        `Tổng số sold: %change`, 
        `Doanh thu: ${dates[0]}`,
        `Doanh thu: ${dates[1]}`,
        `Doanh thu: Change`,
        `Doanh thu: %change`,
        'Stock hiện tại', 'Store có hàng', 
        'Giá Hasaki hiện tại', 'Giá đối thủ thấp nhất', 
        'URL giá đối thủ thấp nhất'
      ];
    } else {
      heading = [
        'Sku', 
        'Product Name', 'Brand', 'Vendor', 
        `Tổng số sold: ${dates[0]}`,
        `Doanh thu: ${dates[0]}`,
        'Stock hiện tại', 'Store có hàng', 
        'Giá Hasaki hiện tại', 'Giá đối thủ thấp nhất', 
        'URL giá đối thủ thấp nhất'
      ];
    }
    let data: any[] = [];
    body.map((ele: any)=> {
      let item: any[] = [];
      item.push(ele.key);
      item.push(ele?.moreInfo?.skuName ?? '');
      item.push(ele?.moreInfo?.brand ?? '');
      item.push(ele?.moreInfo?.vendor ?? '');

      const totalSoldFirst: number = ele[`${query.startDateFirst}-${query.endDateFirst}`]?.itemsPurchasedInside?.value;
      item.push(totalSoldFirst);
      if (isCompare) {
        const totalSoldSecond: number = ele[`${query.startDateSecond}-${query.endDateSecond}`]?.itemsPurchasedInside?.value;
        item.push(totalSoldSecond);
        const changeTotalSold: number = totalSoldFirst - totalSoldSecond;
        item.push(changeTotalSold)
        const revenueFirtsPercent = ele[`percent`]?.itemsPurchasedInside?.value;
        let revenueFirtsPercentString:string =  revenueFirtsPercent;
        if (revenueFirtsPercent == null || revenueFirtsPercent == 'Infinity' || revenueFirtsPercent == Number.isNaN(revenueFirtsPercent) || revenueFirtsPercent == Infinity) {
          revenueFirtsPercentString = 'NaN';
        } else {
          revenueFirtsPercentString = revenueFirtsPercent?.toFixed(2) + "%" || 0 + "%";
        }
        item.push(revenueFirtsPercentString);
      }

      const totalRevenueFirst: number = ele[`${query.startDateFirst}-${query.endDateFirst}`]?.itemRevenueInside?.value;
      item.push(totalRevenueFirst);
      if(isCompare){
        const totalRevenueSecond: number = ele[`${query.startDateSecond}-${query.endDateSecond}`]?.itemRevenueInside?.value;
        item.push(totalRevenueSecond);
        const changeTotalRevenue: number = totalRevenueFirst - totalRevenueSecond;
        item.push(changeTotalRevenue);
        const revenueSecondPercent = ele[`percent`]?.itemRevenueInside?.value ;
        let revenueSecondPercentString:string = revenueSecondPercent;
        if (revenueSecondPercent == null || revenueSecondPercent == 'Infinity' || revenueSecondPercent == Number.isNaN(revenueSecondPercent) || revenueSecondPercent == Infinity) {
          revenueSecondPercentString = 'NaN';
        } else {
          revenueSecondPercentString = revenueSecondPercent?.toFixed(2) + "%" || 0 + "%";
        }
        item.push(revenueSecondPercentString);
      }
      item.push(ele?.moreInfo?.realAvailable);
      item.push(ele?.moreInfo?.storeInstock?.shopActive+'/'+ele?.moreInfo?.storeInstock?.stockShop);
      item.push(ele?.moreInfo?.hskPrice);
      item.push(ele?.moreInfo?.minPrice);
      item.push(ele?.moreInfo?.minPriceUrls);
      data.push(item)
    })
  
    return { dates, heading, data, totalPage };
  }

  async getPriceInfo(query: any): Promise<any> {
    const {body, totalPage} = await this.elasticService.getPriceInfo(query);
    return { body, totalPage};
  }

  async exportPriceInfoQueue(query: any): Promise<any> {
    const data: any = getObjectExcel(query, this.endPoindIO, this.bucketIO);
    query.esRow = data;
    try {
      const date = new Date();
      const stringNumber = date.getTime().toString();
      const index = stringNumber + "-" + data.userId  + "-" + generateUniqueString();
      await this.elasticService.indexDownloadFileES(data, index);
      const jobProcessorPriceData:string = `${process.env.EXCEL_PRICE_QUEUE_PROCESSOR}`;
      await this.queueService.addJob(query, jobProcessorPriceData);
      return "Export excel is processing";
    } catch (e) {
      await this.elasticService.updateDownloadFileES(query.esRow, statusFileDownload.failure);
      console.log("err exportPriceQueue");
      throw new Error(`ZipService: ${e}`);
    }
  }

  async exportCheckPriceExcel(query: any) {
    const esRow: any = query.esRow;
    const folderExcelPath: string = `Export/${query.nameFileFolder}/`;
    const folderZipPath: string = query.folderZipPath;
    const zipName: string = `${query.nameFileFolder}${query.typeFile}`;
    const nameUserFile: string = query.nameUserFile;
    const priceKeys: string[] = checkPriceMetrics;
    
    const itemIdTiktok: string = "item_id_tiktok"
    try {
        const perPage: number = query.perPage;
        const q: any = query?.filter ?? {};
        q.page = 1;
        q.pageNumber = 500;
        let isLoop = true;
        let dataExcel: DataExcel;
        let data = [];
        let count: number = 1;
        let headers: any[] = checkPriceHeaderExcel;
        createTemporaryFile(folderExcelPath, folderZipPath);
        let fileZarPaths: string[] = [];
        let fileNameExcel: string = '';
        while (isLoop) {
          const {body, totalPage} = await this.elasticService.getPriceInfo(q);
          if (body.length === 0) {
            isLoop = false;
          }
          q.page++;
          let formatItem: any[] = [];
          for (const item of body) {
            let itemExcel: any = [];
            for (const header of headers) {
              if (priceKeys.includes(header.key) && item[header.key] < 0) {
                itemExcel.push({key:header.key, value: "N/A", hyperLink: ''});
              } else if (header.key === itemIdTiktok && item[priceKeys[1]] === -1) {
                itemExcel.push({key:header.key, value: "", hyperLink: ''});
              } else if (header.key === priceKeys[3]) {
                itemExcel.push({key:header.key, value: item[header.key], hyperLink: item['url_lazada_key']});
              } else if (header.key === priceKeys[0]) {
                itemExcel.push({key:header.key, value: item[header.key], hyperLink: `https://hasaki.vn/san-pham/${item['url_key']}`});
              } else if (header.key === priceKeys[1]) {
                itemExcel.push({key:header.key, value: item[header.key], hyperLink: `https://www.tiktok.com/view/product/${item['item_id_tiktok']}`});
              } else if (header.key === priceKeys[2]) {
                itemExcel.push({key:header.key, value: item[header.key], hyperLink: `https://shopee.vn/ -i.18644537.${item['item_id_shopee']}`});
              }
              else {
                itemExcel.push({key:header.key, value: item[header.key], hyperLink: ''});
              }
            } 
            formatItem.push(itemExcel);
          } 
          data = [...data, ...formatItem];
          if (data.length >= perPage) {
            fileNameExcel = `${folderExcelPath}${nameUserFile}(${count}).xlsx`;
            dataExcel = { nameFile: fileNameExcel, heading: headers, rawData: data };
            fileZarPaths.push(fileNameExcel);
            await this.excelService.exportToExcelCheckPrice(dataExcel);
            data = [];
            count += 1;
          }
        }
        fileNameExcel = `${folderExcelPath}${nameUserFile}(${count}).xlsx`;
        dataExcel = { nameFile: fileNameExcel, heading: headers, rawData: data };
        fileZarPaths.push(fileNameExcel);
        await this.excelService.exportToExcelCheckPrice(dataExcel);
        await this.zipService.zipFiles(fileZarPaths, `${folderZipPath}${zipName}`);
        await this.elasticService.updateDownloadFileES(esRow, statusFileDownload.completed);
        await cleanupFolders([folderExcelPath, folderZipPath]);
        return query;
    } catch (err) {
      console.error('exportCheckPriceExcel Errors : ', err.message);
      await cleanupFolders([folderExcelPath, folderZipPath]);
      await this.elasticService.updateDownloadFileES(esRow, statusFileDownload.failure);
      throw new Error(`Oops! Something went wrong: ${err.message}`);
    }
  }

  async dowloadExcel(query: any) {
    const fileKey: any = JSON.parse(query.fileKey)
    const queryParams:  { fileKey?: any} = {
      fileKey: fileKey.fileKey
    }
    
    const itemFileFileHstory:any[] = await this.elasticService.runGetFileHistoryByCondition(queryParams);
    if (itemFileFileHstory.length == 0) {
      return "The user hasn't exported the excel file";
    }

    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const fileHistorys: any[] = await this.elasticService.runGetFileHistoryByCondition(queryParams);
          const fileHistory: any = fileHistorys.length > 0 ? fileHistorys[0] : {};
          if (fileHistorys.length > 0 && ( fileHistory.status === statusFileDownload.completed || fileHistory.status === statusFileDownload.failure )) {
            clearInterval(interval); 
            resolve(fileHistory); 
          }
        } catch (error) {
          clearInterval(interval); 
          reject(error); 
        }
      }, 5000);
    });
  }

  async saveProductHealthAndBeautyToCache() {
    const skus: any = await this.getProductHealthAndBeauty();
    const stringValue = JSON.stringify(skus);
    const key:string =`${process.env.APP_ENV}${Cache.PRODUCTS_TOP_300}`;
    await this.redisService.set(key, stringValue);
  }

  async getSkuTop300ToCache() {
    const key:string =`${process.env.APP_ENV}${Cache.PRODUCTS_TOP_300}`;
    const results:any = await this.redisService.get(key);
    const skuTop300: any = JSON.parse(results);
    return skuTop300;
  }

  async deteleFileHistoryIndex() {
    try {
      await this.elasticService.deleteFileHistoryIndex();
      const folderExcelPath: string = `Export/`;
      fs.rmdir(folderExcelPath, { recursive: true }, (err) => {
        if (err) {
          console.error('Error deleting folder:', err);
          return;
        }
      });
      return 1;
    } catch (error) {
      throw error
    }
  }

  async updateFileDownloadFail() {
    try {
     return await this.elasticService.updateFailDownloadFile();
    } catch (error) {
      throw error
    }
  }

  async deleteDownloadFileByDay(){
    try {
      const historyFiles = await this.elasticService.deleteDownloadFileByDay();
      for(const obj of historyFiles.hits.hits) {
        if(obj._source.status === statusFileDownload.completed){
          const key:string = obj?.pathName;
          await this.minioService.deleteFile(key);
        }
      }
    } catch (error) {
      throw error
    }
  }

  async putMappingAnalyticsInfo(){
    try {
      return await this.elasticService.putMappingAnalyticsInfo();
    } catch (error) {
      throw error
    }
  }

  async putMappingCampaignInfo(){
    try {
      return await this.elasticService.putMappingCampaignInfo();
    } catch (error) {
      throw error
    }
  }

  async putMappingHistoryFileInfo(){
    try {
      return await this.elasticService.putMappingHistoryFileInfo();
    } catch (error) {
      throw error
    }
  }

  async putMappingPriceInfo(){
    try {
      return await this.elasticService.putMappingPriceInfo();
    } catch (error) {
      throw error
    }
  }

  async putMaxWindowPriceInfo(){
    try {
      return await this.elasticService.putMaxWindowPriceInfo();
    } catch (error) {
      throw error
    }
  }

  async putMappingShoppingPerformanceView(){
    try {
      return await this.elasticService.putMappingShoppingPerformanceView();
    } catch (error) {
      throw error
    }
  }

  async searchESClient(index, query){
    try {
      return await this.elasticService.searchESClient(index, query);
    } catch (error) {
      throw error
    }
  }
}