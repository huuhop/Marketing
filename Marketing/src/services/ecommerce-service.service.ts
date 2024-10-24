import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { ECOMERCE_AVAILABLE_STORE_URL, ECOMERCE_PRODUCT_NEW, ECOMERCE_PROMOTIONS_URL } from 'src/common/base-url';

@Injectable()
export class EcommerceService {

  private readonly ecomerceProductUrl = ECOMERCE_PRODUCT_NEW;
  private readonly token = process.env.MODE === 'production' ? process.env.ECOMERCE_TOKEN : process.env.ECOMERCE_STAGING_TOKEN
  private readonly tokenProduction = process.env.ECOMERCE_TOKEN
  private readonly ecomercePromotionURL = ECOMERCE_PROMOTIONS_URL;
  private readonly ecomerceAvailableStoreUrl = ECOMERCE_AVAILABLE_STORE_URL;
  private readonly ecomercePromotionToken: string = process.env.MODE === 'qc' ? process.env.ECOMERCE_STAGING_TOKEN : process.env.ECOMERCE_TOKEN

  
  async getEcommerceProductNews(): Promise<any> {
    try {
      const response = await axios({
        method: "GET",
        url: this.ecomerceProductUrl,
        headers: {
          authorization: `${this.tokenProduction}`,
        },
      });
      const ecomerceProductNews = response?.data?.data;
      return ecomerceProductNews;
    } catch (error) {
      console.error('Error getEcommerceProductNews:', error.message);
      throw new Error(`Error getEcommerceProductNews: ${error}`);
    }
  }

  async getEcommerceAvailableStores(): Promise<any> {
    try {
      const response = await axios({
        method: "GET",
        url: this.ecomerceAvailableStoreUrl,
        headers: {
          authorization: `${this.token}`,
        },
      });
      const data = response?.data?.data;
      return data;
    } catch (error) {
      console.error('Error getEcommerceAvailableStores:', error.message);
      throw error;
    }
  }

  async getEcommercePromotionAllRule(): Promise<any> {
    try {
      const response = await axios({
        method: "GET",
        url: this.ecomercePromotionURL,
        headers: {
          authorization: `${this.ecomercePromotionToken}`,
        },
      });
      const ecomerceAllRule = response?.data?.data;
      return ecomerceAllRule;
    } catch (error) {
      console.error('Error getEcommercePromotionAllRule:', error.message);
      // throw error;
    }
  }
}