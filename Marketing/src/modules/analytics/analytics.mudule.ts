import { Module, forwardRef } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { Products } from 'src/entities/products.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RedisService } from 'src/services/redis.service';
import { ProductStocks } from 'src/entities/product_stocks.entity';
import { GoogleAnalyticsService } from 'src/services/google-analytics.service';
import Rest from 'src/request/rest';
import { ElasticModule } from '../elastic/elastic.module';
import { ProductBrands } from 'src/entities/product_brands.entity';
import { Stocks } from 'src/entities/stocks.entity';
import { Skus } from 'src/entities/skus.entity';
import { InsideService } from 'src/services/inside.service';
import { CityInside } from 'src/entities/city_inside.entity';
import { GoogleAnalyticsAppService } from 'src/services/google-analytics-app.service';
import { OffLineReciptService } from 'src/services/offline-receipt.service';
import { ReceiptDetails } from 'src/entities/receipt_details.entity';
import { EcommerceService } from 'src/services/ecommerce-service.service';
import { ShopeeService } from 'src/services/shopee.service';
import { LazadaService } from 'src/services/lazada.service';
import { GoogleApiService } from 'src/services/googleapi.service';
import { ExcelService } from 'src/services/excel.service';
import { ZipService } from 'src/services/zip.service';
import { TiktokService } from 'src/services/tiktok.service';
import { Orders } from 'src/entities/orders.entity';
import { QueueModule } from '../queue/queue.module';
import { MinIOService } from 'src/services/minIO.service';
import { OrdersBackup } from 'src/entities/orders_backup.entity';

@Module({
  imports: [
    forwardRef(() => QueueModule),
    TypeOrmModule.forFeature([Products, ProductStocks, ProductBrands, Stocks, Skus, CityInside, ReceiptDetails, Orders, OrdersBackup]),
    forwardRef(() => ElasticModule),
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    RedisService,
    GoogleAnalyticsService,
    GoogleAnalyticsAppService,
    Rest,
    InsideService,
    OffLineReciptService,
    EcommerceService,
    ShopeeService,
    LazadaService,
    TiktokService,
    GoogleApiService,
    ExcelService,
    ZipService,
    MinIOService
  ],
  exports: [AnalyticsService]
})
export class AnalyticsModule {}