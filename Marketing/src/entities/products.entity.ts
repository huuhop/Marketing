import { Column, Entity, JoinColumn, JoinTable, OneToMany, OneToOne, PrimaryGeneratedColumn, Timestamp } from "typeorm";
import { ProductStocks } from "./product_stocks.entity";
import { ProductBrands } from "./product_brands.entity";
import { Vendors } from "./vendor.entity";

@Entity()
export class Products {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    sku: number;

    @Column()
    name: string;

    @Column()
    country_of_manufacture: string;
    
    @Column()
    brand: string;

    @Column()
    brand_id: number;

    @Column()
    product_type: string;

    @Column()
    product_type_id: number;

    @Column()
    product_category_id: number;

    @Column()
    categories: string;

    @Column()
    cost: number;

    @Column()
    lowest_price: number;

    @Column()
    market_price: number;

    @Column()
    product_price: number;

    @Column()
    vendor: string;

    @Column()
    combo_details: string;

    @Column()
    product_config: number;

    @Column()
    stock_config: string;

    @Column()
    product_shelf_life_month: number;

    @Column()
    barcode: string;

    @Column()
    status: string;

    @Column()
    created_at_date: Date;

    @Column()
    first_imported_at: number;

    @Column()
    created_at: Date;

    @Column()
    updated_at: Date;

    @Column()
    rules: number;

    @Column()
    hsk_price: number;

    @Column()
    hsk_base_price: number;

    @Column()
    vendor_marketing: number;

    @Column()
    last_vendor_id: number;

    @Column()
    other_lowest_price: number;

    @Column()
    other_lowest_price_url: string;

    @Column()
    other_lowest_price_data: string;

    @Column()
    check_prices_properties: string;

    @Column()
    available_date: number;

    @Column()
    url_key: string;

    @OneToMany(() => ProductStocks, productStock => productStock.product)
    productStocks: ProductStocks[];

    @OneToOne(() => ProductBrands, productBrand => productBrand.products)
    @JoinColumn([{ name: 'brand_id', referencedColumnName: 'id' }])
    productBrand: ProductBrands

    @OneToOne(() => Vendors, productBrand => productBrand.products)
    @JoinColumn([{ name: 'vendor_marketing', referencedColumnName: 'vendor_id' }])
    vendorMaketing: Vendors

    @OneToOne(() => Vendors, vendor => vendor.products)
    @JoinColumn([{ name: 'last_vendor_id', referencedColumnName: 'vendor_id' }])
    lastVendor: Vendors
}