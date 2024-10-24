import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { ProductStocks } from "./product_stocks.entity";

@Entity()
export class CityInside {
    @PrimaryGeneratedColumn()
    city_id: number;

    @Column()
    city_name: string;

    @Column()
    city_code: string;

    @Column()
    city_status: number;

    @Column()
    properties: string;

    @Column()
    zone_code: number;
}