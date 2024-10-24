import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Products } from "./products.entity";

@Entity()
export class Vendors {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    vendor_id: number;

    @Column()
    vendor_name: string;

    @Column()
    vendor_email: string;

    @Column()
    vendor_company: string;

    @Column()
    vendor_phone: string;

    @Column()
    vendor_address: string;

    @Column()
    vendor_desc: string;

    @Column()
    vendor_brand_id: string;

    @Column()
    vendor_status: number;

    @Column()
    voucher_ctime: number;

    @Column()
    registration_number: string;

    @Column()
    vendor_code: string;

    @Column()
    vendor_approve: number;

    @Column()
    vendor_category_define: number;

    @Column()
    properties: string;

    @Column()
    fast_code: string;

    @Column()
    vend_credit: number;

    @Column()
    vend_debit: number;

    @Column()
    config_zone: number;

    @Column()
    debt_limit: number;

    @Column()
    vendor_ctime: number;

    @Column()
    vendor_utime: number;

    @OneToMany(() => Products, (product) => product.vendor)
    // @JoinColumn([{ name: 'sku', referencedColumnName: 'sku' }])
    products: Products[]
}