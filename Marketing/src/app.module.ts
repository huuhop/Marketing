import {  Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { dataSourceOptions } from './db/dataSource';
import { AnalyticsModule } from './modules/analytics/analytics.mudule';
import { AuthModule } from './modules/auth/auth.module';
import { CacheModule} from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet'
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ConfigModule.forRoot(),
    CacheModule.register({
      store: redisStore,
      isGlobal: true,
      url: process.env.URL_CACHE
    }),
    TypeOrmModule.forRoot(dataSourceOptions),
    AnalyticsModule,
    AuthModule,
  ]
})
export class AppModule {}
