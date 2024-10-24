import { Injectable, Logger } from '@nestjs/common';
import { SHOPEE_HOST, SHOPEE_PATH_BASE_INFO, SHOPEE_PATH_ITEM_LIST, SHOPEE_PATH_MODEL_LIST } from 'src/common/base-url';
import cryptoJs from 'crypto-js'
import axios from 'axios';
import { RedisService } from './redis.service';
import { Cache } from 'src/common';
import { axiosRequest } from 'src/utilities/helper';

@Injectable()
export class ShopeeService {
  private readonly shopId: string = process.env.SHOP_ID;
  private readonly partnerId: string = process.env.PARTNER_ID;
  private readonly shopeeItemListUrl: string = SHOPEE_HOST+SHOPEE_PATH_ITEM_LIST;
  private readonly shopeeListBaseInfoUrl: string = SHOPEE_HOST+SHOPEE_PATH_BASE_INFO;
  private readonly shopeeModelListUrl: string = SHOPEE_HOST+SHOPEE_PATH_MODEL_LIST;
  private readonly partnerKey: string = process.env.PARTNER_KEY;
  constructor(
    protected redisService: RedisService
  ) {
  }

  async getItemList(query: any): Promise<any> {
    try {
      const accessToken:any = await this.getToken();
      const timestamp: number = this.getTimestamp();
      const sign: string = this.getSign(timestamp, SHOPEE_PATH_ITEM_LIST, accessToken);

      const config: any = {
        params: {
          partner_id: this.partnerId,
          access_token: accessToken,
          shop_id: this.shopId,
          timestamp,
          sign,
          offset: query?.offset,
          page_size: query?.page_size,
          item_status: query?.item_status
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }
      const res = await axiosRequest(this.shopeeItemListUrl, config, "GET");
      return res?.response;

    } catch (e) {
      console.log("getItemListShopee ")
      throw e;
    }
  } 

  async getItemBaseInfo(itemIds: number[]): Promise<any> {
    try {
      const accessToken:any = await this.getToken();
      const timestamp: number = this.getTimestamp();
      const sign: string = this.getSign(timestamp, SHOPEE_PATH_BASE_INFO, accessToken);

      const config: any = {
        params: {
          partner_id: this.partnerId,
          access_token: accessToken,
          shop_id: this.shopId,
          timestamp,
          sign,
          item_id_list: itemIds.join(','),
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }

      const res = await axiosRequest(this.shopeeListBaseInfoUrl, config, "GET");
      return res?.response;

    } catch (e) {
      console.log("getItemBaseInfoShopee ", e.message);
      throw new Error(e);
    }
  }

  async getModeList(itemId: any): Promise<any> {
    try {
      const accessToken:any = await this.getToken();
      const timestamp: number = this.getTimestamp();
      const sign: string = this.getSign(timestamp, SHOPEE_PATH_MODEL_LIST, accessToken);

      const config: any = {
        params: {
          partner_id: this.partnerId,
          access_token: accessToken,
          shop_id: this.shopId,
          timestamp,
          sign,
          item_id: itemId,
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }
      const res = await axiosRequest(this.shopeeModelListUrl, config, "GET");
      return res?.response;

    } catch (e) {
      console.log("getModeListShopee ", e.message)
      throw new Error(e);
    }
  }

  getTimestamp(): number{
    return Math.floor(Date.now() / 1000);
  }

  getSign(timest: number, path: string, accessToken: any): string{
    const baseString = `${this.partnerId}${path}${timest}${accessToken}${this.shopId}`;
    const sign = cryptoJs.HmacSHA256(baseString, this.partnerKey).toString();
    return sign;
  }

  async receiveToken(token: string){
    const key: string=`${process.env.APP_ENV}${Cache.SHOPEE_MARKETING_TOKEN}`;
    await this.redisService.set(key, token)
    const res = await this.getToken();
    if(res === token) {
      return "Received Token shopee successfully";
    }
    return "Something went wrong";
  }

  async getToken(){
    const key = `${process.env.APP_ENV}${Cache.SHOPEE_MARKETING_TOKEN}`;
    return await this.redisService.get(key);
  }
}
