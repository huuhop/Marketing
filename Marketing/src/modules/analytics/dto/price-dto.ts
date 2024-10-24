import { IsNotEmpty, IsNumberString, IsString } from "class-validator";

export class PriceDto {
    @IsNotEmpty()
    @IsNumberString()
    readonly pageNumber?: string;

    @IsNotEmpty()
    @IsNumberString()
    readonly page?: string;
}