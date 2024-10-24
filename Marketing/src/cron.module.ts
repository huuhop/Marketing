import {  Module } from '@nestjs/common';
import { CronsModule } from './modules/crons/crons.module';
import { dataSourceOptions } from './db/dataSource';
import { TypeOrmModule } from '@nestjs/typeorm';
import { redisStore } from 'cache-manager-redis-yet';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    CacheModule.register({
      store: redisStore,
      isGlobal: true,
      url: process.env.URL_CACHE
    }),
    TypeOrmModule.forRoot(dataSourceOptions),
    ScheduleModule.forRoot(),
    CronsModule,
  ],
})
export class CronModule {}
