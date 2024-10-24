import { Column, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn, Timestamp } from "typeorm";
import { Receipts } from "./receipts.entity";

@Entity()
export class ReceiptDetails {
    @PrimaryGeneratedColumn()
    receiptdt_id: number;

    @Column()
    receiptdt_receipt_id: number;

    @Column()
    receiptdt_sku: string;

    @Column()
    receiptdt_sku_type: number;
    
    @Column()
    receiptdt_price: number;

    @Column()
    receiptdt_discount: number;

    @Column()
    receiptdt_qty: number;

    @Column()
    receiptdt_discount_rule: number;

    @Column()
    receiptdt_type: number;

    @Column()
    receiptdt_voucher_id: number;

    @Column()
    receiptdt_ctime: number;

    @Column()
    receiptdt_status: number;

    @Column()
    receiptdt_campaign_id: number;

    @Column()
    receiptdt_bundle: number;

    @Column()
    receiptdt_combo_sku: number;

    @Column()
    invoice_code: number;

    @Column()
    created_at: Date;

    @Column()
    updated_at: Date;

    @ManyToOne(() => Receipts, (receipts) => receipts.receipt_id)
    @JoinColumn([{ name: 'receiptdt_receipt_id', referencedColumnName: 'receipt_id' }])
    receipt: Receipts
}