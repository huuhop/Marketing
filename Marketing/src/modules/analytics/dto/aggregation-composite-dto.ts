import { IsNotEmpty, IsNumberString, IsString } from "class-validator";

export class AggregationCompositeDto {
    @IsNotEmpty()
    @IsString()
    readonly type?: string;

    @IsNotEmpty()
    @IsString()
    readonly startDateFirst?: string;

    @IsNotEmpty()
    @IsString()
    readonly endDateFirst?: string;

    @IsNotEmpty()
    @IsString()
    readonly sources?: string;

    @IsNotEmpty()
    @IsString()
    readonly isCompare?: string;

    @IsNotEmpty()
    @IsNumberString()
    readonly limit?: string;
}