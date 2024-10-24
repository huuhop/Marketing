import { IsNotEmpty, IsNumberString, IsString } from "class-validator";

export class GetSku {
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
    readonly search?: string;

    @IsNotEmpty()
    @IsNumberString()
    readonly page?: string;

    @IsNotEmpty()
    @IsNumberString()
    readonly size?: string;
}