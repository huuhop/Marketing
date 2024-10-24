import { IsNotEmpty, IsNumberString, IsString } from "class-validator";

export class InsideOrderDto {
    @IsNotEmpty()
    @IsString()
    readonly offset?: string;

    @IsNotEmpty()
    @IsString()
    readonly with_details?: string;

    @IsNotEmpty()
    @IsString()
    readonly limit?: string;

    @IsNotEmpty()
    @IsString()
    readonly startDateFirst?: string;

    @IsNotEmpty()
    @IsString()
    readonly endDateFirst?: string;
}