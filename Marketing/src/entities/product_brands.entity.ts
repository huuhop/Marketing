import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Products } from "./products.entity";

@Entity()
export class ProductBrands {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column()
    code: string;

    @Column()
    thumb: string;

    @Column()
    status: number;

    @Column()
    category_define: number;

    @Column()
    profit_rate: number;

    @OneToMany(() => Products, (product) => product.productBrand)
    products: Products[]
}