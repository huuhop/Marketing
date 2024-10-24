import { IsNotEmpty, IsNumberString, IsString } from "class-validator";

export class PriceFluctuationSku {
    @IsNotEmpty()
    @IsString()
    readonly sku?: string;

    @IsNotEmpty()
    @IsString()
    readonly startDate?: string;

    @IsNotEmpty()
    @IsString()
    readonly endDate?: string;

    @IsNotEmpty()
    @IsString()
    readonly dateType?: number;

    @IsNotEmpty()
    @IsString()
    readonly terms?: string;
}