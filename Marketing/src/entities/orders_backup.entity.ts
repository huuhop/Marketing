import { Entity } from 'typeorm';
import { Orders } from './orders.entity';

@Entity({ name: 'orders_backup' })
export class OrdersBackup extends Orders {
}
