import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class PriceExcelDto {
    @IsNotEmpty()
    @IsString()
    readonly perPage?: string;

    @IsNotEmpty()
    @IsNumber()
    readonly userId?: string;

    @IsNotEmpty()
    @IsString()
    readonly nameUserFile?: string;
}