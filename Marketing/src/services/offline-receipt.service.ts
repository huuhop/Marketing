import { Injectable } from '@nestjs/common';
import { getDateFormat, getNameCity, getObjectBySku, getStockInCatchByStoreID, getRegion, containsHasakiClinicAndSpa } from 'src/utilities/helper';

@Injectable()
export class OffLineReciptService {
  
  async handleOfflineReceipt(query: any, receiptDetails: any, products: any, cities: any, shipperName: string, listCache: any, channelFlag: string): Promise<any> {
    try {
      const data: any = []
      await receiptDetails.forEach((e: any, index: any) => {
          const store = getStockInCatchByStoreID(listCache, e.receipt?.store?.store_stock_id)
          const city = getObjectBySku(store?.name, cities, 'city_name');
          const objBySku = getObjectBySku(e?.receiptdt_sku, products, 'sku');
          const level2 = getObjectBySku('2', objBySku?.categories, 'level');
          const cate: string = level2?.name || "";
          if(containsHasakiClinicAndSpa(cate)){
            return;
          }
          const level3 = getObjectBySku('3', objBySku?.categories, 'level');
          const level4 = getObjectBySku('4', objBySku?.categories, 'level');
          let item = {
            index,
            itemId: e?.receiptdt_sku, 
            date: getDateFormat(query?.startDateFirst) ?? "",
            itemName: objBySku?.name ?? "",
            channel: shipperName,
            channelFlag,
            deviceCategory: shipperName,
            city: getNameCity(city?.city_code) ?? "",
            sessionSourceMedium: shipperName,
            firstUserCampaignName: "",
            itemProductType: objBySku?.product_type ?? "",
            itemInStore: e.receipt?.store?.store_name ?? "",
            region: getRegion(city?.city_id) ?? "",

            itemCategory: level2?.name ?? "",
            itemCategory2: level3?.name ?? "",
            itemCategory3: level4?.name ?? "",
            itemBrand: objBySku?.productBrand?.name ?? "",
            vendor: objBySku?.vendorMaketing?.vendor_name ?? "",
            manufacture: objBySku?.country_of_manufacture ?? "",

            itemsViewed: 0,
            itemsAddedToCart: 0,
            itemsCheckedOut: 0,
            itemsPurchased: 0,
            itemsPurchasedInside: e?.receiptdt_qty,
            itemRevenue: 0,
            itemRevenueInside: (e?.receiptdt_price - e.receiptdt_discount) * e?.receiptdt_qty,
            itemOrderId: e?.receipt?.receipt_code.toString() ?? "",
            itemCreatedDate: e?.receipt?.receipt_cdate ? new Date(e.receipt.receipt_cdate * 1000).toLocaleDateString() : "",
            itemCompletedDate:  e?.receipt?.receipt_udate ? new Date(e.receipt.receipt_udate * 1000).toLocaleDateString() : "",
            itemActiveRule: 0,
            itemGifts: [],
            itemVouchers: [],
            itemChannelDetail: shipperName,
            itemHasakiPrice: objBySku?.hsk_price ?? 0,
            orderCreateDate: e?.receipt?.receipt_cdate,
            orderUpdateDate: e?.receipt?.receipt_udate,
          };
          data.push(item);
      });
      return {
        data,
        startDate:  query?.startDateFirst,
        endDate: query?.startDateFirst,
      };
    } catch (error) {
      console.error('Error:', error.message);
      throw error;
    }
  }
}