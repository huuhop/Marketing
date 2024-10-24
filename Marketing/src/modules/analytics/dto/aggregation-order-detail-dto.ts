import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class AggregationOrderDetailDto {
    @IsNotEmpty()
    @IsString()
    readonly startDate?: string;

    @IsNotEmpty()
    @IsString()
    readonly endDate?: string;

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