import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { QueueCLIModule } from './queueCLI.module';

async function bootstrap() {
  process.env.TZ = "Asia/Ho_Chi_Minh";
  const app = await NestFactory.createApplicationContext(QueueCLIModule);
}
bootstrap();