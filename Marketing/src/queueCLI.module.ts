import {  Module } from '@nestjs/common';
import { dataSourceOptions } from './db/dataSource';
import { TypeOrmModule } from '@nestjs/typeorm';
import { redisStore } from 'cache-manager-redis-yet';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { ProcessorModule } from './modules/processor/processor.module';

@Module({
  imports: [
    CacheModule.register({
      store: redisStore,
      isGlobal: true,
      url: process.env.URL_CACHE
    }),
    TypeOrmModule.forRoot(dataSourceOptions),
    ProcessorModule,
  ],
})
export class QueueCLIModule {}
