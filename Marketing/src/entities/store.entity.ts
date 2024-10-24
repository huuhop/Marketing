import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Receipts } from "./receipts.entity";

@Entity()
export class Store {
    @PrimaryGeneratedColumn()
    store_id: number;

    @Column()
    store_name: string;

    @Column()
    store_location_id: number;

    @Column()
    store_service_id: number;

    @Column()
    store_stock_id: number;

    @Column()
    store_status: number;

    @Column()
    account_id: number;

    @Column()
    location_id: number;

    @Column()
    store_config: number;

    @Column()
    properties: string;

    @Column()
    store_invoice_series: string;

    @Column()
    config_zone: number;

    @Column()
    pickup_location_group_name: String;

    @Column()
    stock_type: String;

    @OneToMany(() => Receipts, (receipts) => receipts.store)
    receipts: Receipts[];
}