import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { RedisService } from './redis.service';
import { Cache } from 'src/common';
import * as CryptoJS from 'crypto-js';
import { axiosRequest } from 'src/utilities/helper';

@Injectable()
export class LazadaService {
  private readonly AppKey: string = process.env.LAZADA_APP_KEY;
  private readonly AppSecret: string = process.env.LAZADA_APP_SECRET;
  private readonly SignMethod: string = "hmac-sha256";
  private readonly endpoint = process.env.LAZADA_URL + '/products/get';
  constructor(
    protected redisService: RedisService
  ) {

  }

  async getItemList(query: any): Promise<any> {
    try {
      const timestamp: number = this.getTimestamp(); // Current timestamp in seconds
      const accessToken: any = await this.getToken();

      // Parameters
      const params: any = {
        app_key: this.AppKey,
        timestamp: timestamp,
        access_token: accessToken,
        sign_method: this.SignMethod,
        limit: query.limit || 50, // Set default limit to 10 if not provided
        offset: query.offset || 0,
        filter: 'all'
        // sku_seller_list: JSON.stringify(ids),
      };
      // API name
      const apiName = '/products/get';
      // Generate signature
      const signature = this.generateSignature(params, '', apiName, this.AppSecret);

      // Add signature to params
      params['sign'] = signature;
      const config: any = {
          params: params,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      // Make the API request
      const response = await axiosRequest(this.endpoint, config, "GET");
      return response;
    } catch (e) {
      throw e;
    }
  } 

  getTimestamp(): number{
    return Math.floor(Date.now());
  }

  private generateSignature(params: { [key: string]: string }, body: string, apiName: string, secretKey: string): string {
    // Sort parameters
    const sortedKeys = Object.keys(params).sort();

    // Concatenate the sorted parameters and their values
    const queryString = sortedKeys.map(key => `${key}${params[key]}`).join('');
    const stringToSign = `${apiName}${queryString}${body}`;

    // Generate the HMAC-SHA256 signature
    const signature = CryptoJS.HmacSHA256(stringToSign, secretKey).toString(CryptoJS.enc.Hex);

    return signature.toUpperCase();
  }

  async receiveToken(token: string){
    const key=`${process.env.APP_ENV}${Cache.LAZADA_MARKETING_TOKEN}`;
    await this.redisService.set(key, token)
    const res = await this.getToken();
    if(res === token) {
      return "Received token lazada successfully";
    }
    return "Something went wrong";
  }

  async getToken(){
    const key = `${process.env.APP_ENV}${Cache.LAZADA_MARKETING_TOKEN}`;
    return await this.redisService.get(key);
  }
}
