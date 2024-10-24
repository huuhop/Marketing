import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Products } from "./products.entity";

@Entity()
export class ProductStocks {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    sku: number;

    @Column()
    stock_id: number;

    @Column()
    sold: number;

    @Column()
    total_qty: number;

    @Column()
    combo_sold_qty: number;

    @Column()
    available: number;

    @Column()
    real_available: number;

    @Column()
    incoming: number;

    @Column()
    est_incoming: number;

    @Column()
    wh_available: number;

    @Column()
    shop_best_sold: number;

    @Column()
    best_sold_qty: number;

    @Column()
    amount: number;

    @Column()
    sold_month: number;

    @Column()
    sold_percent: number;

    @Column()
    wh_percent: number;

    @Column()
    is_best_seller: number;

    @Column()
    active: number;

    @Column()
    total_sold_qty: number;

    @Column()
    total_available: number;

    @Column()
    total_amount_sku: number;

    @Column()
    total_incoming: number;

    @Column()
    total_sold_month: number;

    @Column()
    wh_incoming: number;

    @Column()
    redundant_sold_month: number;

    @Column()
    zone_available: number;

    @Column()
    zone_sold_qty: number;

    @Column()
    zone_incoming: number;

    @Column()
    zone_sold_month: number;

    @Column()
    processing_step: number;

    @Column()
    processing_data: number;

    @Column()
    in_stock: number;

    @Column()
    available_it: number;

    @Column()
    is_new_stock: number;

    @Column()
    shared_incoming: number;

    @Column()
    origin_incoming: number;

    @Column()
    has_problem: number;

    @Column()
    stock_expected_date: number;

    @Column()
    pickup_location_group_name: number;

    @Column()
    pickup_location_group_id: number;

    @Column()
    stock_date: number;

    @Column()
    total_in_stock: number;

    @Column()
    is_no_date: number;

    @Column()
    created_at_date: number;

    @Column()
    first_imported_at: number;


    @Column()
    created_at: Date;

    @Column()
    updated_at: Date;

    @Column()
    negative_time_in_stock: number;

    @ManyToOne(() => Products, (product) => product.sku)
    @JoinColumn([{ name: 'sku', referencedColumnName: 'sku' }])
    product: Products
}