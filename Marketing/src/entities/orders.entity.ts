import { Column, Entity, JoinColumn, JoinTable, OneToMany, OneToOne, PrimaryGeneratedColumn, Timestamp } from "typeorm";
import { ProductStocks } from "./product_stocks.entity";
import { ProductBrands } from "./product_brands.entity";
import { Vendors } from "./vendor.entity";

@Entity()
export class Orders {
    @PrimaryGeneratedColumn()
    order_id: number;

    @Column()
    order_code: string;

    @Column()
    order_customer_id: number;

    @Column()
    order_address: string;
    
    @Column()
    order_district: number;

    @Column()
    order_city: number;

    @Column()
    order_ward: number;

    @Column()
    order_type: number;

    @Column()
    order_parent_id: number;

    @Column()
    order_is_preorder: number;

    @Column()
    order_cdate: number;

    @Column()
    order_udate: number;

    @Column()
    order_user_id: number;

    @Column()
    order_shipper_id: number;

    @Column()
    order_shipping_fdate: number;

    @Column()
    order_shipping_tdate: number;

    @Column()
    order_company_id: number;

    @Column()
    order_note: string;

    @Column()
    order_priority: number;

    @Column()
    order_total_item: number;

    @Column()
    order_subtotal: number;

    @Column()
    order_discount: number;

    @Column()
    order_voucher_code: string;

    @Column()
    order_shipping_fee: number;

    @Column()
    order_total: number;

    @Column()
    order_payment_amount: number;

    @Column()
    order_payment_method: number;

    @Column()
    order_status: number;

    @Column()
    order_sysdate: number;

    @Column()
    order_completed_date: number;

    @Column()
    order_print_date: number;

    @Column()
    order_ischeck: number;

    @Column()
    order_store_id: number;

    @Column()
    order_options: string;

    @Column()
    reason_delay: string;

    @Column()
    pickup_store_id: number;

    @Column()
    config: number;

    @Column()
    sponsor: number;

    @Column()
    created_at: Date;

    @Column()
    updated_at: Date;

    @OneToMany(() => ProductStocks, productStock => productStock.product)
    productStocks: ProductStocks[];

    @OneToOne(() => ProductBrands, productBrand => productBrand.products)
    @JoinColumn([{ name: 'brand_id', referencedColumnName: 'id' }])
    productBrand: ProductBrands

    @OneToOne(() => Vendors, productBrand => productBrand.products)
    @JoinColumn([{ name: 'vendor_marketing', referencedColumnName: 'vendor_id' }])
    vendorMaketing: Vendors
}