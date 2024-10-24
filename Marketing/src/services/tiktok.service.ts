import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { RedisService } from './redis.service';
import { Cache } from 'src/common';
import * as crypto from 'crypto';
import { axiosRequest } from 'src/utilities/helper';

@Injectable()
export class TiktokService {
  constructor(
    protected redisService: RedisService
  ) {
  }

  async getItemList() {
    const url = 'https://open-api.tiktokglobalshop.com/product/202309/products/search';
    const apiPath = '/product/202309/products/search';
    const accessToken: any = await this.getToken();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const secretKey = process.env.TIKTOK_APP_SECRET;
    const shopCipherData: any = await this.getShopCipher();
    const shopCipher: string = shopCipherData.data.shops[0].cipher;
    const queryParams: any = {
      app_key: process.env.TIKTOK_APP_KEY,
      shop_cipher: shopCipher,
      timestamp: timestamp,
      page_size: 100
    };
    // Generate the sign parameter
    const sign = this.generateSign(apiPath, queryParams, secretKey);
    queryParams.sign = sign;
    const query: any = {
      app_key: process.env.TIKTOK_APP_KEY,
      sign,
      timestamp,
      shop_cipher: shopCipher,
      page_size:100,
    }
    const body = {
      status: 'ALL',
    };

    const config = {
      params: query,
      headers: {
        'content-type': 'application/json',
        'x-tts-access-token': accessToken,
      },
      data: body,
    };

    try {
      const response = await axiosRequest(url, config, "POST");
      return response;
    } catch (error) {
      console.error('Request failed with error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch product list: ${error.message}`);
    }
  }

  private generateSign(apiPath: string, params: any, secretKey: string): string {
    // Reorder the params based on alphabetical order
    const sortedKeys = Object.keys(params).sort();

    // Concat all the params in the format of {key}{value}
    let stringToBeSigned = apiPath;
    sortedKeys.forEach(key => {
      stringToBeSigned += `${key}${params[key]}`;
    });

    // Wrap string generated with app_secret
    stringToBeSigned = secretKey + stringToBeSigned + secretKey;

    return this.hmacSha256(stringToBeSigned, secretKey);
  }

  private hmacSha256(data: string, key: string): string {
    return crypto.createHmac('sha256', key).update(data).digest('hex');
  }

  async receiveToken(token: string){
    const key=`${process.env.APP_ENV}${Cache.TIKTOK_MARKETING_TOKEN}`;
    await this.redisService.set(key, token);
    const res = await this.getToken();
    if(res === token) {
      return "Received token tiktok successfully";
    }
    return "Something went wrong";
  }

  async getToken(){
    const key = `${process.env.APP_ENV}${Cache.TIKTOK_MARKETING_TOKEN}`;
    return await this.redisService.get(key);
  }

  async getShopCipher(){
    const url = 'https://open-api.tiktokglobalshop.com/authorization/202309/shops';
    const apiPath = '/authorization/202309/shops';
    const accessToken: any = await this.getToken();
    const timestamp = Math.floor(Date.now() / 1000);
    const secretKey = process.env.TIKTOK_APP_SECRET;

    const queryParams: any = {
      app_key: process.env.TIKTOK_APP_KEY,
      timestamp: timestamp,
    };

    // Generate the sign parameter
    const sign = this.generateSign(apiPath, queryParams, secretKey);
    queryParams.sign = sign;

    const config = {
      params: queryParams,
      headers: {
        'Content-Type': 'application/json',
        'x-tts-access-token': accessToken,
      },
    };

    try {
      const response = await axiosRequest(url, config, "GET");
      return response;
    } catch (error) {
      console.error('Request failed with error:', error.response?.data || error.message);
      throw new Error(`Failed to fetch authorized shops: ${error.message}`);
    }
  }

  private generateSHA256(input: string, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(input);
    return hmac.digest('hex');
  }

  private generateSignature(params: Record<string, any>, path: string, body: string, secret: string): string {
      const keys = Object.keys(params).filter(key => key !== 'sign' && key !== 'access_token').sort();
      const input = keys.reduce((acc, key) => acc + key + params[key], path) + body;
      const wrappedInput = secret + input + secret;
      return this.generateSHA256(wrappedInput, secret);
  }

  async searchProducts(q: any) {
    const appKey = process.env.TIKTOK_APP_KEY;
    const secret = process.env.TIKTOK_APP_SECRET;
    const accessToken: any = await this.getToken();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const shopCipherData: any = await this.getShopCipher();
    const shopCipher: string = shopCipherData.data.shops[0].cipher;
    let params: any = {
        app_key: appKey,
        timestamp: timestamp,
        shop_cipher: shopCipher,
        page_size: q.pageSize
    };

    const path = '/product/202312/products/search';
    let bodyParams: any = {
      status: 'ACTIVATE'
    }
    if(q?.nextPageToken){
      params.page_token = q?.nextPageToken;
    }
    const body = JSON.stringify(bodyParams);
    const sign = this.generateSignature(params, path, body, secret);
    const url = `https://open-api.tiktokglobalshop.com${path}`;
    params['sign'] = sign;

    try {
      const config: any = {
        params: params,
        headers: {
          'Content-Type': 'application/json',
          'x-tts-access-token': accessToken,
        },
        data: body,
      }
      const response = await axiosRequest(url, config, "POST");
      return response;
    } catch (error) {
      throw error;
    }
  }

  async getProducts() {
    const appKey = process.env.TIKTOK_APP_KEY;
    const secret = process.env.TIKTOK_APP_SECRET;
    const accessToken: any = await this.getToken();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const shopCipherData: any = await this.getShopCipher();
    const shopCipher: string = shopCipherData.data.shops[0].cipher;
    const pageSize = '1';
    const params = {
        app_key: appKey,
        timestamp: timestamp,
        shop_cipher: shopCipher
    };

    const path = '/product/202309/products/1729700992835095287';
    const sign = this.generateSign(path, params, secret);
    const url = `https://open-api.tiktokglobalshop.com${path}`;
    params['sign'] = sign;

    try {
      const config: any = {
        params: params,
        headers: {
            'Content-Type': 'application/json',
            'x-tts-access-token': accessToken,
        }
      }
      const response = await axiosRequest(url, config, "GET");
      return response.data;
    } catch (e) {
      throw e;
    }
  }

  async searchActivities(q: any) {
    const appKey = process.env.TIKTOK_APP_KEY;
    const secret = process.env.TIKTOK_APP_SECRET;
    const accessToken: any = await this.getToken();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const shopCipherData: any = await this.getShopCipher();
    const shopCipher: string = shopCipherData.data.shops[0].cipher;

    const params = {
        app_key: appKey,
        timestamp: timestamp,
        shop_cipher: shopCipher,
    };

    const path = '/promotion/202309/activities/search';
    const bodyParams: any = {
      status: 'ONGOING',
      page_size: q.pageSize
    }

    if(q?.nextPageToken){
      bodyParams.page_token = q.nextPageToken;
    }

    const body = JSON.stringify(bodyParams);
    const sign = this.generateSignature(params, path, body, secret);

    const url = `https://open-api.tiktokglobalshop.com${path}`;
    params['sign'] = sign;

    try {
      const config: any = {
        params: params,
        headers: {
            'Content-Type': 'application/json',
            'x-tts-access-token': accessToken,
        },
        data: body,
      }
      const response = await axiosRequest(url, config, "POST");
      return response;
    } catch (error) {
        throw error;
    }
  }

  async getActivities(id: string) {
    const appKey = process.env.TIKTOK_APP_KEY;
    const secret = process.env.TIKTOK_APP_SECRET;
    const accessToken: any = await this.getToken();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const shopCipherData: any = await this.getShopCipher();
    const shopCipher: string = shopCipherData.data.shops[0].cipher;

    const params = {
        app_key: appKey,
        timestamp: timestamp,
        shop_cipher: shopCipher
    };

    const path = `/promotion/202309/activities/${id}`;

    const sign = this.generateSign(path, params, secret);

    const url = `https://open-api.tiktokglobalshop.com${path}`;
    params['sign'] = sign;

    try {
      const config: any = {
        params: params,
        headers: {
            'Content-Type': 'application/json',
            'x-tts-access-token': accessToken,
        }
      }
      const response = await axiosRequest(url, config, "GET");
      return response;
    } catch (error) {
      throw error;
    }
  }
}
