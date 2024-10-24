import { Module } from '@nestjs/common';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ElasticService } from './elastic.service';
import { RedisService } from 'src/services/redis.service'
import { EcommerceService } from 'src/services/ecommerce-service.service';
import { GoogleAnalyticsService } from 'src/services/google-analytics.service'

@Module({
    imports: [
        ElasticsearchModule.registerAsync({
            useFactory: async () => ({
                nodes: process.env.URL_ELATIC_SEARCH.split(','),
                sniffOnConnectionFault: true,
                auth: {
                    username: process.env.U_ELATIC_SEARCH,
                    password: process.env.P_ELATIC_SEARCH
                  }
            }),
        }),
    ],
    providers: [ElasticService, RedisService, EcommerceService, GoogleAnalyticsService],
    exports: [ElasticService, ElasticsearchModule]
})
export class ElasticModule {}
