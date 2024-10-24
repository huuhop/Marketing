import { IsNotEmpty, IsNumberString, IsString } from "class-validator";

export class AggregationListOrderDetail {
    @IsNotEmpty()
    @IsString()
    readonly startDate?: string;

    @IsNotEmpty()
    @IsString()
    readonly endDate?: string;

    @IsNotEmpty()
    @IsNumberString()
    readonly perPage?: string;
}