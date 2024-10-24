import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class RedisService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {
  }
  
  private readonly prefix: string = process.env.APP_ENV

  async get(key : string) {
    return await this.cacheManager.get(key);
  }

  async set(key : string, value: unknown) {
    const expirationTimeInSeconds = 7 * 24 * 60 * 60 * 10000; // 7 day in milisecon
    return await this.cacheManager.set(key, value, expirationTimeInSeconds);
  }

  filterStocks(filters: any, data: any) {
    const result = [];
    const stockDataMapping = data;
     Object.entries(stockDataMapping).forEach((value: any) => {
       if (value[1].name.includes(filters.name_starts_with))
       result.push(value)
    });
    return result ;
  }

  async setCache(pre: boolean, key: string, value: unknown, ttl: number) {
    if (!pre) key = this.prefix + key;
    if (ttl) await this.cacheManager.set(key, value, ttl);
    else await this.cacheManager.set(key, value, 0);
    return true;
  }

  async getCache(pre: boolean, key: string) {
    let res: string
    if (!pre) key = this.prefix + key
    res = await this.cacheManager.get(key)
    if (res) return res
    else return false
  }
}