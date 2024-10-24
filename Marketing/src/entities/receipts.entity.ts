import { Column, Entity, JoinColumn, OneToMany, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { ReceiptDetails } from "./receipt_details.entity";
import { Store } from "./store.entity";

@Entity()
export class Receipts {
    @PrimaryGeneratedColumn()
    receipt_id: number;

    @Column()
    receipt_code: number;

    @Column()
    receipt_user_id: number;

    @Column()
    receipt_customer_id: number;
    
    @Column()
    receipt_cdate: number;

    @Column()
    receipt_udate: number;

    @Column()
    receipt_completed_date: number;

    @Column()
    receipt_desc: string;

    @Column()
    receipt_total_item: number;

    @Column()
    receipt_payment: number;

    @Column()
    receipt_bankacc_id: number;

    @Column()
    receipt_subtotal: number;

    @Column()
    receipt_discount: number;

    @Column()
    receipt_total: number;

    @Column()
    receipt_store_id: number;

    @Column()
    receipt_cash: number;

    @Column()
    receipt_card: number;

    @Column()
    receipt_customer_balance: number;

    @Column()
    receipt_status: number;

    @Column()
    receipt_type: number;

    @Column()
    receipt_balance: number;

    @Column()
    receipt_voucher_id: number;

    @Column()
    receipt_total_discount: number;

    @Column()
    net_revenue: number;

    @Column()
    gross_revenue: number;

    @Column()
    reference_code: number;

    @Column()
    config: number;

    @Column()
    created_at: Date;

    @Column()
    updated_at: Date;

    @OneToMany(() => ReceiptDetails, (receiptDetail) => receiptDetail.receipt)
    receiptDetails: ReceiptDetails[];

    @OneToOne(() => Store, (store) => store.receipts)
    @JoinColumn([{ name: 'receipt_store_id', referencedColumnName: 'store_id' }])
    store: Receipts
}