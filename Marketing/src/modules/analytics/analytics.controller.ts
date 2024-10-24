import { Controller, Get, UseGuards, Request, Logger, Query, Param, HttpException, HttpStatus, Body, Post, Res } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { Route } from 'src/common';
import Rest from 'src/request/rest';
import { GetItemsQuery } from './dto/query-items';
import { AggregationDto } from './dto/aggregation-dto';
import { DetailBySku } from './dto/detail-by-sku';
import { InsideOrderDto } from './dto/inside-order-dto';
import { OfflineReceiptDto } from './dto/offline-receipt-dto';
import { GetSku } from './dto/get-sku';
import { AggregationExcelDto } from './dto/aggregation-excel-dto';
import { AggregationOrderDetailDto } from './dto/aggregation-order-detail-dto';
import { AggregationListOrderDetail } from './dto/aggregation-list-order-detail';
import { CampaignDto } from './dto/campaign-dto';
import { PriceDto } from './dto/price-dto';
import { ShopeeService } from 'src/services/shopee.service';
import { LazadaService } from 'src/services/lazada.service';
import { TokenDto } from './dto/token-dto';
import { TrackingSkuDto } from './dto/tracking-sku-dto';
import { GoogleApiService } from 'src/services/googleapi.service';
import { Response, query } from 'express';
import { PriceFluctuationSku } from './dto/price-fluctuation-sku';
import * as fs from 'fs';
import { HistoryFileByUserDto } from './dto/history-file-by-user';
import { TiktokService } from 'src/services/tiktok.service';
import { promises as fsPromises } from 'fs';
import { CampaignDetailDto, CampaignDetailOrderStatusDto } from './dto/campaign-detail-dto';
import { PriceExcelDto } from './dto/price-excel-dto';
import { ElasticService } from 'src/modules/elastic/elastic.service';
import { pageFileName } from 'src/common/commom';
import { RequestExportExcelDto } from 'src/modules/analytics/dto/request-export-excel-dto';
import { ExcelService } from 'src/services/excel.service';
import { CheckProgressExportExcelDto } from 'src/modules/analytics/dto/check-progress-export-excel-dto';
import { GetExcelHistorysDto } from 'src/modules/analytics/dto/get-excel-historys-dto';
import { DownloadExcelDto } from './dto/download-excel-dto';
import { ShoppingViewDto } from './dto/shopping-view-dto';
import { TrackingCostSkuDto } from './dto/tracking-cost-sku-dto';
import { TrackingSkuCampaignOrderDto } from './dto/tracking-sku-campaign-order-dto';
import { UseGuards } from '@nestjs/common';


@Controller()
export class AnalyticsController {
  constructor(
    private readonly analyticService: AnalyticsService,
    private readonly rest: Rest,
    private shopeeService: ShopeeService,
    private lazadaService: LazadaService,
    private tiktokService: TiktokService,
    private googleApiService: GoogleApiService,
    private elasticService: ElasticService,
    private excelService: ExcelService
  ) {
  }

  @Post(Route.PREFIX.MKT + Route.API.GIVEN_TOKEN_SHOPEE)
  @UseGuards(AuthGuard)
  async ReceiveTokenShopee(@Body() TokenDto: TokenDto) {
    const res = await this.shopeeService.receiveToken(TokenDto.token);
    return this.rest.RestSuccess(res);
  }

  @Post(Route.PREFIX.MKT + Route.API.GIVEN_TOKEN_LAZADA)
  @UseGuards(AuthGuard)
  async ReceiveTokenLazada(@Body() TokenDto: TokenDto) {
    const res = await this.lazadaService.receiveToken(TokenDto.token);
    return this.rest.RestSuccess(res);
  }

  @Post(Route.PREFIX.MKT + Route.API.GIVEN_TOKEN_TIKTOK)
  @UseGuards(AuthGuard)
  async ReceiveTokenTitok(@Body() TokenDto: TokenDto) {
    const res = await this.tiktokService.receiveToken(TokenDto.token);
    return this.rest.RestSuccess(res);
  }

  @Get(Route.PREFIX.ANALYTICS + Route.API.GET_TOKEN)
  @UseGuards(AuthGuard)
  async getToken(
  ) {
    const res = await this.analyticService.getToken();
    return this.rest.RestSuccess(res);
  }

  @Get()
  hello(@Request() req) {
    return this.analyticService.hello({
      page: 1,
      limit: 10,
    });
  }

  @Get(Route.PREFIX.ANALYTICS + Route.API.GET_ITEMS_TO_ELASTIC_SEARCH)
  @UseGuards(AuthGuard)
  async handleApiGA4(
    @Query() query: GetItemsQuery
  ) {
    const res = await this.analyticService.handleApiGA4(query);
    return this.rest.RestSuccess(res);
  }

  // @Get(Route.PREFIX.ANALYTICS + Route.API.GET_ITEMS_CAMPAIGN)
  @UseGuards(AuthGuard)
  async handleApiGA4Campaign(
    @Query() query: GetItemsQuery
  ) {
    const res = await this.analyticService.handleApiGA4Campaign(query);
    return this.rest.RestSuccess(res);
  }

  @Get(Route.PREFIX.ANALYTICS + Route.API.GET_ITEMS_CAMPAIGN)
  @UseGuards(AuthGuard)
  async handleApiGAAppCampaign(
    @Query() query: GetItemsQuery
  ) {
    const res = await this.analyticService.handleApiGAAppCampaign(query);
    return this.rest.RestSuccess(res);
  }

  @Get(Route.PREFIX.ANALYTICS + Route.API.GET_ITEMS_APP_TO_ELASTIC_SEARCH)
  @UseGuards(AuthGuard)
  async handleApiGAApp(
    @Query() query: GetItemsQuery
  ) {
    const res = await this.analyticService.handleApiGAApp(query);
    return this.rest.RestSuccess(res);
  }

  @Get(Route.PREFIX.ANALYTICS + Route.API.GET_INSIDE_ORDER)
  @UseGuards(AuthGuard)
  async runInsideOrder(
    @Query() query: InsideOrderDto
  ) {
    const res = await this.analyticService.handleApiInsideOrder(query);
    return this.rest.RestSuccess(res);
  }

  @Get(Route.PREFIX.ANALYTICS + Route.API.GET_INSIDE_ORDER_CANCEL)
  @UseGuards(AuthGuard)
  async runInsideOrderCancel(
    @Query() query: InsideOrderDto
  ) {
    const res = await this.analyticService.handleApiInsideOrderCancel(query);
    return this.rest.RestSuccess(res);
  }


  @Get(Route.PREFIX.ANALYTICS + Route.API.GET_OFFLINE_RECEIPT)
  @UseGuards(AuthGuard)
  async getOfflineReceipt(
    @Query() query: OfflineReceiptDto
  ) {
    const res = await this.analyticService.handleOfflineReceipt(query);
    return this.rest.RestSuccess(res);
  }

  @Get(Route.PREFIX.ANALYTICS + Route.API.RUN_AGGREGATION)
  @UseGuards(AuthGuard)
  async runAggregation(
    @Query() query: AggregationDto
  ) {
    const res = await this.analyticService.runAggregation(query);
    return this.rest.RestSuccess(res);
  }

  @Get(Route.PREFIX.ANALYTICS + Route.API.TRACKING_PERFORMANCE_SKU)
  @UseGuards(AuthGuard)
  async trackingPerformanceSku(
    @Query() query: TrackingSkuDto
  ) {
    const res = await this.analyticService.trackingPerformanceSku(query);
    return this.rest.RestSuccess(res);
  }

  @Get(Route.PREFIX.ANALYTICS + Route.API.TRACKING_COST_SKU)
  @UseGuards(AuthGuard)
  async trackingCostBySku(
    @Query() query: TrackingCostSkuDto
  ) {
    const res = await this.analyticService.trackingCostBySku(query);
    return this.rest.RestSuccess(res);
  }

  @Get(Route.PREFIX.ANALYTICS + Route.API.TRACKING_SKU_CAMPAIGN_ORDER)
  @UseGuards(AuthGuard)
  async trackingSkuCampaignOrder(
    @Query() query: TrackingSkuCampaignOrderDto
  ) {
    const res = await this.analyticService.trackingSkuCampaignOrder(query);
    return this.rest.RestSuccess(res);
  }

  @Get(Route.PREFIX.ANALYTICS + Route.API.EXPORT_TRACKING_PERFORMANCE_SKU_EXCEL)
  @UseGuards(AuthGuard)
  async exportTrackingPerformanceSkuExcel(
    @Query() query: TrackingSkuDto
  ) {
    const res = await this.analyticService.exportTrackingPerformanceSkuExcel(query);
    return this.rest.RestSuccess(res);
  }

  @Get(Route.PREFIX.CAMPAIGN + Route.API.GET_CAMPAIGN)
  @UseGuards(AuthGuard)
  async getCampaign(
    @Query() query: CampaignDto
  ) {
    const res = await this.analyticService.getCampaign(query);
    return this.rest.RestSuccess(res);
  }

  @Get(Route.PREFIX.CAMPAIGN + Route.API.GET_CAMPAIGN_DETAIL)
  @UseGuards(AuthGuard)
  async getCampaignDetail(
    @Query() query: CampaignDetailDto
  ) {
    const res = await this.analyticService.getCampaignDetail(query);
    return this.rest.RestSuccess(res);
  }

  @Get(Route.PREFIX.CAMPAIGN + Route.API.GET_CAMPAIGN_DETAIL_ORDER_STATUS)
  @UseGuards(AuthGuard)
  async getCampaignDetailOrderStatus(@Query() query: CampaignDetailOrderStatusDto) {
    const res = await this.analyticService.getCampaignDetailOrderStatusV2(query);
    return this.rest.RestSuccess(res);
  }

  @Post(Route.PREFIX.CAMPAIGN + Route.API.REQUEST_EXPORT_EXCEL_CAMPAIGN_DETAIL)
  @UseGuards(AuthGuard)
  async requestExportExcel(@Body() body: RequestExportExcelDto) {
    const data = await this.excelService.requestCreateExcelFile(body, `${process.env.EXCEL_CAMPAIGN_ORDER_DETAIL_PROCESSOR}`, pageFileName.campaignDetail);
    return this.rest.RestSuccess(data);
  }

  @Get(Route.PREFIX.ANALYTICS + Route.API.RUN_DETAIL_BY_SKU)
  @UseGuards(AuthGuard)
  async runDetailBySku(
    @Query() query: DetailBySku
  ) {
    const res = await this.analyticService.runDetailBySku(query);
    return this.rest.RestSuccess(res);
  }

  @Get(Route.PREFIX.ANALYTICS + Route.API.GET_PRICE_FLUCTUATION_SKU)
  @UseGuards(AuthGuard)
  async getPriceFluctuationsSku(
    @Query() query: PriceFluctuationSku
  ) {
    const res = await this.analyticService.getPriceFluctuationsSku(query);
    return this.rest.RestSuccess(res);
  }

  @Get(Route.PREFIX.PRICE + Route.API.GET_PRICE_SHOPEE)
  @UseGuards(AuthGuard)
  async getPriceOnShopee(

  ) {
    const res = await this.analyticService.getPriceOnShopee();
    return this.rest.RestSuccess(res);
  }

  @Get(Route.PREFIX.PRICE + Route.API.GET_PRICE_LAZADA)
  @UseGuards(AuthGuard)
  async getPriceOnLazada(

  ) {
    const res = await this.analyticService.getPriceOnLazada();
    return this.rest.RestSuccess(res);
  }

  @Get(Route.PREFIX.PRICE + Route.API.GET_PRICE_HASAKI)
  @UseGuards(AuthGuard)
  async getPriceOnHasaki(

  ) {
    const res = await this.analyticService.getPriceOnHasaki();
    return this.rest.RestSuccess(res);
  }

  @Get(Route.PREFIX.PRICE + Route.API.GET_PRICE_TIKTOK)
  @UseGuards(AuthGuard)
  async getPriceOnTiktok(

  ) {
    const res = await this.analyticService.getPriceOnTiktok();
    return this.rest.RestSuccess(res);
  }

  @Get(Route.PREFIX.ANALYTICS + Route.API.GET_BEST_SELLER)
  @UseGuards(AuthGuard)
  async getBestSeller(
  ) {
    const res = await this.analyticService.getBestSeller();
    return this.rest.RestSuccess(res);
  }

  @Get(Route.PREFIX.ANALYTICS + Route.API.GET_TOP_300)
  @UseGuards(AuthGuard)
  async getTop300(
  ) {
    const res = await this.analyticService.getTop300();
    return this.rest.RestSuccess(res);
  }

  @Get(Route.PREFIX.ANALYTICS + Route.API.GET_SKU)
  @UseGuards(AuthGuard)
  async getSku(
    @Query() query: GetSku
  ) {
    const res = await this.analyticService.getSku(query);
    return this.rest.RestSuccess(res);
  }

  @Get(Route.PREFIX.ANALYTICS + Route.API.EXPORT_DATA_EXCEL)
  @UseGuards(AuthGuard)
  async exportDataExcel(
    @Query() query: AggregationExcelDto
  ) {
    try {
      const res = await this.analyticService.exportDataExcel(query);
      return this.rest.RestSuccess(res);
    } catch (e) {
      console.error(`analytics.controller.exportDataExcel:${e.message}`)
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Post(Route.PREFIX.ANALYTICS + Route.API.EXPORT_ORDER_DETAIL)
  @UseGuards(AuthGuard)
  async exportMasterDetail(
    @Body() body: AggregationOrderDetailDto
  ) {
    try {
      const res = await this.analyticService.exportMasterDetailQueue(body);
      return this.rest.RestSuccess(res);
    } catch (e) {
      console.log("analytics.controller.exportMasterDetail", e)
      throw new HttpException(e.message, e.status || HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Post(Route.API.DOWNLOAD_EXCEL_HISTORY)
  @UseGuards(AuthGuard)
  async dowloadExcelHistory(
    @Body() body: HistoryFileByUserDto,
  ) {
    try {
      const res = await this.analyticService.dowloadExcelHistory(body);
      return this.rest.RestSuccess(res);
    } catch (e) {
      console.log("dowloadExcelHistory", e)
      throw new HttpException(e.message, e.status || HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Post(Route.API.DOWNLOAD_EXCEL)
  @UseGuards(AuthGuard)
  async dowloadExcel(
    @Body() body: DownloadExcelDto
  ) {
    try {
      const res = await this.analyticService.dowloadExcel(body);
      return this.rest.RestSuccess(res);
    } catch (e) {
      console.log("dowloadExcel", e)
      throw new HttpException(e.message, e.status || HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Post(Route.PREFIX.ANALYTICS + Route.API.GET_LIST_ORDER_DETAIL)
  @UseGuards(AuthGuard)
  async getListOrderDetail(
    @Body() body: AggregationListOrderDetail
  ) {
    try {
      const res = await this.analyticService.getListOrderDetail(body);
      return this.rest.RestSuccess(res);
    } catch (e) {
      console.log("analytics.controller.getListOrderDetail", e)
      throw new HttpException(e.message, e.status || HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get(Route.PREFIX.PRICE + Route.API.GET_PRICE_INFO)
  @UseGuards(AuthGuard)
  async getPriceInfo(
    @Query() query: PriceDto
  ) {
    const res = await this.analyticService.getPriceInfo(query);
    return this.rest.RestSuccess(res);
  }

  @Post(Route.PREFIX.PRICE + Route.API.EXPORT_PRICE_INFO_EXCEL)
  @UseGuards(AuthGuard)
  async exportPriceInfoExcel(
    @Body() body: PriceExcelDto
  ) {
    const res = await this.analyticService.exportPriceInfoQueue(body);
    return this.rest.RestSuccess(res);
  }

  @Get(Route.PREFIX.ANALYTICS + Route.API.GET_TOKEN_FROM_GOOGLE_ADS)
  @UseGuards(AuthGuard)
  async getTokenFromGoogleAds() {
    const url = await this.googleApiService.getGoogleApiService();
    return this.rest.RestSuccess(url);
  }

  @Get(Route.PREFIX.ANALYTICS + Route.API.GOOGLE_ADS_CALLBACK)
  @UseGuards(AuthGuard)
  async handleCallback(@Query('code') code: string): Promise<any> {
    try {
      const res = await this.googleApiService.exchangeCodeForToken(code);
      return this.rest.RestSuccess(res);
    } catch (e) {
      throw new HttpException(e.message, e.status || HttpStatus.INTERNAL_SERVER_ERROR)
    }
  }

  @Get(Route.PREFIX.ANALYTICS + Route.API.GET_CAMPAIGN_GOOGLE_ADS)
  @UseGuards(AuthGuard)
  async getCampaignGooleAds(
    @Query() query: ShoppingViewDto
  ): Promise<any> {
    try {
      const res = await this.analyticService.handleShoppingPerformance(query);
      return this.rest.RestSuccess(res);
    } catch (e) {
      console.log(e.errors);
      throw e.errors
    }
  }

  @Get(Route.PREFIX.ANALYTICS + Route.API.UPDATE_FILE_DOWLOAD_FAIL)
  @UseGuards(AuthGuard)
  async updateFileDownloadFail(): Promise<any> {
    try {
      const res = await this.analyticService.updateFileDownloadFail();
      return this.rest.RestSuccess(res);
    } catch (e) {
      console.log(e.errors)
      throw e.errors
    }
  }

  @Get(Route.PREFIX.ANALYTICS + Route.API.DELETE_FILE_HISTORY_INDEX)
  @UseGuards(AuthGuard)
  async handleDeleteFileHistoryIndex(): Promise<any> {
    try {
      const res = await this.analyticService.deteleFileHistoryIndex();
      return this.rest.RestSuccess(res);
    } catch (e) {
      console.log(e.errors)
      throw e.errors
    }
  }

  @Post(Route.PREFIX.EXCEL + Route.API.GET_EXCEL_HISTORYS)
  @UseGuards(AuthGuard)
  async getExcelHistorys(@Body() body: GetExcelHistorysDto) {
    const data = await this.elasticService.runGetFileHistoryByUserId(body.userId, body.excelPage);
    return this.rest.RestSuccess(data);
  }

  @Post(Route.PREFIX.EXCEL + Route.API.CHECK_EXPORT_EXCEL_PROGRESS)
  @UseGuards(AuthGuard)
  async checkProgressExportExcel(@Body() body: CheckProgressExportExcelDto) {
    const data = await this.excelService.checkProgressExportExcel(body);
    return this.rest.RestSuccess(data);
  }

  @Get(Route.PREFIX.ANALYTICS + Route.API.GET_PRODUCT_BY_HEALTH_AND_BEAUTY)
  @UseGuards(AuthGuard)
  async getProductHealthAndBeauty(): Promise<any> {
    try {
      const res = await this.analyticService.getProductHealthAndBeauty();
      return this.rest.RestSuccess(res);
    } catch (e) {
      console.log(e.errors)
      throw e.errors
    }
  }

  @Get(Route.PREFIX.PRICE + Route.API.GET_ALL_PRICE_INFO)
  @UseGuards(AuthGuard)
  async getAllPriceInfo(): Promise<any> {
    try {
      const res = await this.analyticService.getAllPriceInfo();
      return this.rest.RestSuccess(res);
    } catch (e) {
      console.log(e.errors)
      throw e.errors
    }
  }

  @Get(Route.PREFIX.PRICE + Route.API.PUT_MAPPING_ANALYTICS_INFO)
  @UseGuards(AuthGuard)
  async putMappingAnalyticsInfo(): Promise<any> {
    try {
      const res = await this.analyticService.putMappingAnalyticsInfo();
      return this.rest.RestSuccess(res);
    } catch (e) {
      console.log(e.errors)
      throw e.errors
    }
  }

  @Get(Route.PREFIX.PRICE + Route.API.PUT_MAPPING_CAMPAIGN_INFO)
  @UseGuards(AuthGuard)
  async putMappingCampaignInfo(): Promise<any> {
    try {
      const res = await this.analyticService.putMappingCampaignInfo();
      return this.rest.RestSuccess(res);
    } catch (e) {
      console.log(e.errors)
      throw e.errors
    }
  }

  @Get(Route.PREFIX.PRICE + Route.API.PUT_MAPPING_HISTORY_FILE_INFO)
  @UseGuards(AuthGuard)
  async putMappingHistoryFileInfo(): Promise<any> {
    try {
      const res = await this.analyticService.putMappingHistoryFileInfo();
      return this.rest.RestSuccess(res);
    } catch (e) {
      console.log(e.errors)
      throw e.errors
    }
  }

  @Get(Route.PREFIX.PRICE + Route.API.PUT_MAPPING_PRICE_INFO)
  @UseGuards(AuthGuard)
  async putMappingPriceInfo(): Promise<any> {
    try {
      const res = await this.analyticService.putMappingPriceInfo();
      return this.rest.RestSuccess(res);
    } catch (e) {
      console.log(e.errors)
      throw e.errors
    }
  }

  @Get(Route.PREFIX.PRICE + Route.API.PUT_MAX_WINDOW_PRICE_INFO)
  @UseGuards(AuthGuard)
  async putMaxWindowPriceInfo(): Promise<any> {
    try {
      const res = await this.analyticService.putMaxWindowPriceInfo();
      return this.rest.RestSuccess(res);
    } catch (e) {
      console.log(e.errors)
      throw e.errors
    }
  }


  @Get(Route.PREFIX.ANALYTICS + Route.API.PUT_MAPPING_SHOPPING_VIEW_INFO)
  @UseGuards(AuthGuard)
  async putMappingShoppingViewInfo(): Promise<any> {
    try {
      const res = await this.analyticService.putMappingShoppingPerformanceView();
      return this.rest.RestSuccess(res);
    } catch (e) {
      console.log(e.errors)
      throw e.errors
    }
  }

  @Post(Route.PREFIX.ANALYTICS + Route.API.SEARCH_ES)
  @UseGuards(AuthGuard)
  async queryES(
    @Query('index') index: string,
    @Body() query: any,
  ): Promise<any> {
    try {
      const res = await this.analyticService.searchESClient(index, query);
      return this.rest.RestSuccess(res);
    } catch (e) {
      console.log(e.errors);
      throw e.errors;
    }
  }
}