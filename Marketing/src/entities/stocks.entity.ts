import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Stocks {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column()
    status: number;

    @Column()
    inside_status: number;

    @Column()
    location_id: number;

    @Column()
    is_physical: number;

    @Column()
    is_share: number;

    @Column()
    sort_order: number;

    @Column()
    config_zone: number;

    @Column()
    revenue: number;

    @Column()
    grand_opening_at: Date;

    @Column()
    pickup_location_group_id: number;

    @Column()
    pickup_location_group_name: String;

    @Column()
    stock_type: String;
}