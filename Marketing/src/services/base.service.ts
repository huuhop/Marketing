import { Injectable } from '@nestjs/common';
import dataSource from 'src/db/dataSource';

@Injectable()
export class BaseService {
  constructor() {
  }
  
  async query(sql: string, params?: any, options?: any): Promise<any> {
    try {
      const isInitialized: boolean = dataSource.isInitialized 
      if (!isInitialized) {
        await dataSource.initialize()
      }
      const results = await dataSource.query(sql, params)
      return results;

    } catch (e) {
      return e.message;
    }
  }
}