import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { OrderTracking } from 'src/common';
import { INSIDE_ORDER_URL } from 'src/common/base-url';
import { getDateFormat, getNameCity, getObjectBySku, getRegion, checkPromotion, containsHasakiClinicAndSpa } from 'src/utilities/helper';
import moment from 'moment';

@Injectable()
export class InsideService {

  private readonly insideOrderUrl = INSIDE_ORDER_URL;
  private readonly token = process.env.INSIDE_TOKEN;

  async getInsideOrder(query: any, offs: number, products: any, cities: any, shipperId: number, shipperName: string, dataGA4filter: any, channelFlag: string): Promise<any> {
    try {
      const data: any = [];
      let campaign: any = [];
      let params: any = query;
      let offset = offs;
      while (true) {
        const insideData: any = await this.fetchInsideOrders(params, offset, shipperId);
        if (!insideData || !insideData?.rows || insideData.rows.length === 0) {
          break;
        }
        offset = Number(offset) + Number(params.limit);
        await insideData.rows.forEach((row: any) => {
          row.details.forEach((e: any) => {
            if(e.order_status === OrderTracking.STATUS_CANCEL){
              return;
            }
            const city = getObjectBySku(row?.order_city, cities, 'city_id');
            const objBySku = getObjectBySku(e?.orderdt_product_sku, products, 'sku');
            const level2 = getObjectBySku('2', objBySku?.categories, 'level');
            const cate: string = level2?.name || "";
            if(containsHasakiClinicAndSpa(cate)){
              return;
            }
            const level3 = getObjectBySku('3', objBySku?.categories, 'level');
            const level4 = getObjectBySku('4', objBySku?.categories, 'level');

            let item = {
              index: e.orderdt_id,
              itemId: e.orderdt_product_sku.toString(), 
              date: getDateFormat(query?.from_cdate) ?? "",
              itemName: objBySku?.name ?? "",
              channel: shipperName,
              channelFlag,
              deviceCategory: shipperName,
              city: getNameCity(city?.city_code) ?? "",
              sessionSourceMedium: shipperName,
              firstUserCampaignName: "",
              itemProductType: objBySku?.product_type ?? "",
              itemInStore: "",
              region: getRegion(row?.order_city) ?? "",

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
              itemsPurchasedInside: e?.orderdt_product_qty,
              itemRevenue: 0,
              itemRevenueInside: (e?.orderdt_product_price - e.orderdt_product_discount) * e?.orderdt_product_qty,
              itemOrderId: row?.order_code.toString() ?? "",
              itemCreatedDate: row.order_cdate ? new Date(row.order_cdate * 1000).toLocaleDateString() : "",
              itemCompletedDate: row.order_completed_date ? new Date(row.order_completed_date * 1000).toLocaleDateString() : "",
              itemActiveRule: 0,
              itemGifts: '',
              itemVouchers: '',
              itemChannelDetail: shipperName,
              itemHasakiPrice: 0,
              orderCreateDate: row?.order_cdate,
              orderUpdateDate: row?.order_udate,
            };

            if (item.itemChannelDetail === 'Online') {
              for (let data of dataGA4filter) {
                if (item.itemId === data.dimensionValues[0].value && item.itemOrderId === data.dimensionValues[2].value) {
                  item.itemChannelDetail = data.dimensionValues[1].value === '(not set)' ? 'Online' : data.dimensionValues[1].value ?? '';
                  break;
                }
              }
            }
            data.push(item);
          })

          campaign.push({
            transactionId: row?.order_code.toString() ?? "",
            status: row?.order_status ?? 0,
            insideCreatedDate: row.order_cdate
          });
        });
      }
      return {
        data,
        campaign,
        startDate:  query?.from_cdate,
        endDate: query?.from_cdate,
      };
    } catch (error) {
      console.error('Error:', error.message);
      throw error;
    }
  }

  async fetchInsideOrders(query: any, offs: number, shipperId: number) {
    const response = await axios({
      method: "GET",
      url: this.insideOrderUrl,
      params: {
        offset: offs,
        with_details: query?.with_details,
        shipper_id: shipperId,
        limit: query?.limit,
        from_cdate: query?.from_cdate,
        to_cdate: query?.to_cdate,
      },
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    return response?.data?.data;
  }

  async getInsidePlatformOrder(query: any, offs: number, products: any, cities: any, platForm: string, name: string, channelFlag: string): Promise<any> {
    try {
      const data: any = [];
      let campaign: any = [];
      let params: any = query;
      let offset = offs;
      while (true) {
        const insideData: any = await this.fetchInsidePlatformOrder(params, offset, platForm);
        if (!insideData || !insideData?.rows || insideData.rows.length === 0) {
            break;
        }
        offset = Number(offset) + Number(params.limit);
        await insideData.rows.forEach((row: any) => {
            row.details.forEach((e: any) => {
              if(e.order_status === OrderTracking.STATUS_CANCEL){
                return;
              }
              const objBySku = getObjectBySku(e?.orderdt_product_sku, products, 'sku');
              const city = getObjectBySku(row?.order_city, cities, 'city_id');
              const level2 = getObjectBySku('2', objBySku?.categories, 'level');
              const cate: string = level2?.name || "";
              if(containsHasakiClinicAndSpa(cate)){
                return;
              }
              const level3 = getObjectBySku('3', objBySku?.categories, 'level');
              const level4 = getObjectBySku('4', objBySku?.categories, 'level');
              let item = {
                index: e.orderdt_id,
                itemId: e.orderdt_product_sku.toString(), 
                date: getDateFormat(query?.from_cdate) ?? "",
                itemName: objBySku?.name ?? "",
                channel: name,
                channelFlag,
                deviceCategory: name,
                city: getNameCity(city?.city_code) ?? "",
                sessionSourceMedium: name,
                firstUserCampaignName: "",
                itemProductType: objBySku?.product_type ?? "",
                itemInStore: "",
                region: getRegion(row?.order_city) ?? "",
    
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
                itemsPurchasedInside: e?.orderdt_product_qty,
                itemRevenue: 0,
                itemRevenueInside: (e?.orderdt_product_price - e.orderdt_product_discount) * e?.orderdt_product_qty,
                itemOrderId: row?.order_code.toString() ?? "",
                itemCreatedDate: row.order_cdate ? new Date(row.order_cdate * 1000).toLocaleDateString() : "",
                itemCompletedDate: row.order_completed_date ? new Date(row.order_completed_date * 1000).toLocaleDateString() : "",
                itemActiveRule: 0,
                itemGifts: [],
                itemVouchers: [],
                itemChannelDetail: name,
                itemHasakiPrice: objBySku?.hsk_price ?? 0,
                orderCreateDate: row?.order_cdate,
                orderUpdateDate: row?.order_udate,
              };
              data.push(item);
            })
            campaign.push({
              transactionId: row?.order_code.toString() ?? "",
              status: row?.order_status ?? 0,
              insideCreatedDate: row.order_cdate
            });
          });
       }
      return {
        data,
        campaign,
        startDate:  query?.to_cdate,
        endDate: query?.to_cdate,
      };
    } catch (error) {
      console.error('Error:', error.message);
      throw error;
    }
  }

  async fetchInsidePlatformOrder(query: any, offs: number, platForm: string) {
    const response = await axios({
      method: "GET",
      url: this.insideOrderUrl,
      params: {
        offset: offs,
        with_details: query?.with_details,
        platform: platForm,
        limit: query?.limit,
        from_cdate: query?.from_cdate,
        to_cdate: query?.to_cdate,
      },
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });
    
    return response?.data?.data;
  }

  async getInsideOrderCancel(query: any, offs: number, shipperId: number, shipperName: string, channelFlag: string): Promise<any> {
    try {
      const data: any = [];
      let params: any = query;
      let offset = offs;
      while (true) {
        const insideData: any = await this.fetchInsideOrdersCancel(params, offset, shipperId);
        if (!insideData || !insideData?.rows || insideData.rows.length === 0) {
          break;
        }
        offset = Number(offset) + Number(params.limit);
        await insideData.rows.forEach((row: any) => {
          const cDate = moment.unix(row.order_udate).format("YYYY-MM-DD");
          let item = {
            itemOrderId: row.order_code.toString() ?? "",
            date: getDateFormat(cDate),
            channel: shipperName,
            channelFlag
          };
          data.push(item);
        });
      }
      return {
        data,
        startDate:  query?.from_completed_date,
        endDate: query?.to_completed_date,
      };
    } catch (error) {
      console.error('Error:', error.message);
      throw error;
    }
  }

  async fetchInsideOrdersCancel(query: any, offs: number, shipperId: number) {
    const response = await axios({
      method: "GET",
      url: this.insideOrderUrl,
      params: {
        offset: offs,
        shipper_id: shipperId,
        limit: query?.limit,
        from_completed_date: query?.from_completed_date,
        to_completed_date: query?.to_completed_date,
        status: OrderTracking.STATUS_CANCEL
      },
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    return response?.data?.data;
  }

  async getInsidePlatformOrderCancel(query: any, offs: number,  platForm: string, shipperName: string, channelFlag: string): Promise<any> {
    try {
      const data: any = [];
      let params: any = query;
      let offset = offs;
      while (true) {
        const insideData: any = await this.fetchInsidePlatformOrderCancel(params, offset, platForm);
        if (!insideData || !insideData?.rows || insideData.rows.length === 0) {
          break;
        }
        offset = Number(offset) + Number(params.limit);
        await insideData.rows.forEach((row: any) => {
          const cDate = moment.unix(row.order_udate).format("YYYY-MM-DD");
          let item = {
            itemOrderId: row.order_code.toString() ?? "",
            date: getDateFormat(cDate),
            channel: shipperName,
            channelFlag
          };
          data.push(item);
        });
      }
      return {
        data,
        startDate:  query?.from_completed_date,
        endDate: query?.to_completed_date,
      };
    } catch (error) {
      console.error('Error:', error.message);
      throw error;
    }
  }

  async fetchInsidePlatformOrderCancel(query: any, offs: number, platForm: string) {
    const response = await axios({
      method: "GET",
      url: this.insideOrderUrl,
      params: {
        offset: offs,
        platform: platForm,
        limit: query?.limit,
        from_completed_date: query?.from_completed_date,
        to_completed_date: query?.to_completed_date,
        status: OrderTracking.STATUS_CANCEL
      },
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    return response?.data?.data;
  }
}