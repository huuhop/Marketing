import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { CronModule } from './cron.module';

async function bootstrap() {
  process.env.TZ = "Asia/Ho_Chi_Minh";
  const app = await NestFactory.createApplicationContext(CronModule);
}
bootstrap();