import { IsNotEmpty, IsNumberString, IsString } from "class-validator";

export class TrackingSkuDto {
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
    readonly terms?: string;

    @IsNotEmpty()
    @IsString()
    readonly isCompare?: string;

    @IsNotEmpty()
    @IsNumberString()
    readonly pageNumber?: string;

    @IsNotEmpty()
    @IsNumberString()
    readonly page?: string;
}