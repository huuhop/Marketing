import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Skus {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    sku: number;

    @Column()
    name: string;

    @Column()
    is_best_seller: number;
}