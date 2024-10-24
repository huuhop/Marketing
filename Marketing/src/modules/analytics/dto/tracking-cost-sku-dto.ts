import { IsNotEmpty, IsNumberString, IsString } from "class-validator";

export class TrackingCostSkuDto {
    @IsNotEmpty()
    @IsString()
    readonly startDateFirst?: string;

    @IsNotEmpty()
    @IsString()
    readonly endDateFirst?: string;

    @IsNotEmpty()
    @IsString()
    readonly isCompare?: string;

    @IsNotEmpty()
    @IsString()
    readonly terms?: string;

    @IsNotEmpty()
    @IsNumberString()
    readonly pageNumber?: number;

    @IsNotEmpty()
    @IsNumberString()
    readonly page?: number;
}