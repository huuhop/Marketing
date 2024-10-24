import { IsNotEmpty, IsNumberString, IsString } from "class-validator";

export class DetailBySku {
    @IsNotEmpty()
    @IsString()
    readonly sku?: string;
}